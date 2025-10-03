import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac } from 'crypto';
import { LoginDto } from 'src/auth/dto/login.dto';
import { RefreshTokenDto } from 'src/auth/dto/refresh-token.dto';
import { SessionRecord, SessionStore } from 'src/auth/session.store';
import { AuditService } from 'src/common/services/audit.service';
import { Role } from 'src/common/types/role.enum';
import { UsersService } from 'src/users/users.service';

interface JwtPayload {
  sub: string;
  email: string;
  roles: string[];
  sessionId: string;
  iat: number;
  exp: number;
}

export interface SignedTokens {
  tokenType: 'Bearer';
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  session: Omit<SessionRecord, 'refreshToken' | 'userId'>;
}

@Injectable()
export class AuthService {
  private readonly jwtSecret = 'education-platform-secret';
  private readonly accessTokenTtlMs = 15 * 60 * 1000;
  private readonly refreshTokenTtlMs = 30 * 24 * 60 * 60 * 1000;

  constructor(
    private readonly usersService: UsersService,
    private readonly sessionStore: SessionStore,
    private readonly auditService: AuditService,
  ) {}

  async login(
    request: LoginDto,
    traceId: string | undefined,
    metadata: { ipAddress?: string; userAgent?: string },
  ): Promise<SignedTokens> {
    const user = await this.usersService.validateCredentials(
      request.email,
      request.password,
    );
    if (!user) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'The provided credentials are invalid.',
      });
    }

    const session = await this.sessionStore.create(
      user.id,
      this.refreshTokenTtlMs,
      {
        deviceId: request.deviceId,
        deviceName: request.deviceName,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
      },
    );

    const tokens = await this.generateTokens(
      user.id,
      user.email,
      user.roles,
      session,
    );

    this.auditService.record('auth.login', {
      userId: user.id,
      traceId,
      metadata: {
        sessionId: session.id,
        deviceId: request.deviceId,
        ipAddress: metadata.ipAddress,
      },
    });

    return tokens;
  }

  async refreshTokens(
    request: RefreshTokenDto,
    traceId: string | undefined,
  ): Promise<SignedTokens> {
    const session = await this.sessionStore.findByRefreshToken(
      request.refreshToken,
    );
    if (!session) {
      throw new UnauthorizedException({
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Refresh token is not recognized.',
      });
    }

    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      await this.sessionStore.revoke(session.id);
      throw new UnauthorizedException({
        code: 'REFRESH_TOKEN_EXPIRED',
        message: 'Refresh token has expired. Please login again.',
      });
    }

    const user = await this.usersService.findUserRecordById(session.userId);
    if (!user) {
      await this.sessionStore.revoke(session.id);
      throw new UnauthorizedException({
        code: 'ACCOUNT_NOT_FOUND',
        message: 'User account could not be located.',
      });
    }

    const rotated = await this.sessionStore.rotateRefreshToken(
      session.id,
      this.refreshTokenTtlMs,
    );
    if (!rotated) {
      throw new UnauthorizedException({
        code: 'SESSION_NOT_ACTIVE',
        message: 'Session is no longer active.',
      });
    }

    const tokens = await this.generateTokens(
      user.id,
      user.email,
      user.roles,
      rotated,
    );

    this.auditService.record('auth.refresh', {
      userId: user.id,
      traceId,
      metadata: {
        sessionId: rotated.id,
      },
    });

    return tokens;
  }

  async verifyAccessToken(token: string): Promise<{
    id: string;
    email: string;
    roles: Role[];
    sessionId: string;
  }> {
    const payload = this.decodeAndVerifyToken(token);
    if (payload.exp * 1000 <= Date.now()) {
      throw new UnauthorizedException({
        code: 'ACCESS_TOKEN_EXPIRED',
        message: 'Access token has expired.',
      });
    }

    const session = await this.sessionStore.touch(payload.sessionId);
    if (!session || session.userId !== payload.sub) {
      throw new UnauthorizedException({
        code: 'SESSION_NOT_ACTIVE',
        message: 'Session is not active.',
      });
    }

    const user = await this.usersService.findUserRecordById(payload.sub);
    if (!user) {
      throw new UnauthorizedException({
        code: 'ACCOUNT_NOT_FOUND',
        message: 'User account could not be located.',
      });
    }

    return {
      id: user.id,
      email: user.email,
      roles: user.roles,
      sessionId: session.id,
    };
  }

  async listSessions(
    userId: string,
  ): Promise<Omit<SessionRecord, 'refreshToken' | 'userId'>[]> {
    const sessions = await this.sessionStore.listByUser(userId);
    return sessions.map((s) => {
      const copy: Partial<typeof s> = { ...s };
      delete copy.refreshToken;
      delete copy.userId;
      return copy as Omit<SessionRecord, 'refreshToken' | 'userId'>;
    });
  }

  async revokeSession(
    userId: string,
    sessionId: string,
    traceId: string | undefined,
  ): Promise<void> {
    const session = await this.sessionStore.findOwnedBy(userId, sessionId);
    if (!session) {
      throw new NotFoundException({
        code: 'SESSION_NOT_FOUND',
        message: 'Session could not be found for the user.',
      });
    }

    await this.sessionStore.revoke(sessionId);
    this.auditService.record('auth.session.revoked', {
      userId,
      traceId,
      metadata: { sessionId },
    });
  }

  private async generateTokens(
    userId: string,
    email: string,
    roles: string[],
    session: SessionRecord,
  ): Promise<SignedTokens> {
    const activeSession =
      (await this.sessionStore.touch(session.id)) ?? session;
    const now = Math.floor(Date.now() / 1000);
    const payload: JwtPayload = {
      sub: userId,
      email,
      roles,
      sessionId: activeSession.id,
      iat: now,
      exp: now + Math.floor(this.accessTokenTtlMs / 1000),
    };
    const header = this.base64UrlEncode(
      JSON.stringify({ alg: 'HS256', typ: 'JWT' }),
    );
    const body = this.base64UrlEncode(JSON.stringify(payload));
    const signature = this.sign(`${header}.${body}`);
    const token = `${header}.${body}.${signature}`;

    return {
      tokenType: 'Bearer',
      accessToken: token,
      expiresIn: Math.floor(this.accessTokenTtlMs / 1000),
      refreshToken: activeSession.refreshToken,
      session: {
        id: activeSession.id,
        createdAt: activeSession.createdAt,
        lastAccessedAt: activeSession.lastAccessedAt,
        expiresAt: activeSession.expiresAt,
        device: activeSession.device,
      },
    };
  }

  private decodeAndVerifyToken(token: string): JwtPayload {
    const segments = token.split('.');
    if (segments.length !== 3) {
      throw new UnauthorizedException({
        code: 'INVALID_TOKEN_FORMAT',
        message: 'Token structure is invalid.',
      });
    }

    const [headerSegment, payloadSegment, signature] = segments;
    const expectedSignature = this.sign(`${headerSegment}.${payloadSegment}`);
    if (!this.timingSafeEqual(signature, expectedSignature)) {
      throw new UnauthorizedException({
        code: 'INVALID_TOKEN_SIGNATURE',
        message: 'Token signature is invalid.',
      });
    }

    const payloadJson = Buffer.from(payloadSegment, 'base64url').toString(
      'utf8',
    );
    const payload = JSON.parse(payloadJson) as JwtPayload;

    if (!payload.sub || !payload.sessionId) {
      throw new UnauthorizedException({
        code: 'INVALID_TOKEN_PAYLOAD',
        message: 'Token payload is incomplete.',
      });
    }

    return payload;
  }

  private sign(content: string): string {
    return createHmac('sha256', this.jwtSecret)
      .update(content)
      .digest('base64url');
  }

  private base64UrlEncode(content: string): string {
    return Buffer.from(content).toString('base64url');
  }

  private timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let mismatch = 0;
    for (let i = 0; i < a.length; i += 1) {
      mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return mismatch === 0;
  }
}
