/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/require-await */
import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac } from 'crypto';
import { Role } from 'src/common/types/role.enum';
import { AuditService } from '../common/services/audit.service';
import { UsersService } from '../users/users.service';
import { LoginRequest } from './dto/login.dto';
import { RefreshTokenRequest } from './dto/refresh-token.dto';
import { SessionRecord, SessionStore } from './session.store';

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
    request: LoginRequest,
    traceId: string | undefined,
    metadata: { ipAddress?: string; userAgent?: string },
  ): Promise<SignedTokens> {
    const user = this.usersService.validateCredentials(
      request.email,
      request.password,
    );
    if (!user) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'The provided credentials are invalid.',
      });
    }

    const session = this.sessionStore.create(user.id, this.refreshTokenTtlMs, {
      deviceId: request.deviceId,
      deviceName: request.deviceName,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });

    const tokens = this.generateTokens(
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
    request: RefreshTokenRequest,
    traceId: string | undefined,
  ): Promise<SignedTokens> {
    const session = this.sessionStore.findByRefreshToken(request.refreshToken);
    if (!session) {
      throw new UnauthorizedException({
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Refresh token is not recognized.',
      });
    }

    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      this.sessionStore.revoke(session.id);
      throw new UnauthorizedException({
        code: 'REFRESH_TOKEN_EXPIRED',
        message: 'Refresh token has expired. Please login again.',
      });
    }

    const user = this.usersService.findUserRecordById(session.userId);
    if (!user) {
      this.sessionStore.revoke(session.id);
      throw new UnauthorizedException({
        code: 'ACCOUNT_NOT_FOUND',
        message: 'User account could not be located.',
      });
    }

    const rotated = this.sessionStore.rotateRefreshToken(
      session.id,
      this.refreshTokenTtlMs,
    );
    if (!rotated) {
      throw new UnauthorizedException({
        code: 'SESSION_NOT_ACTIVE',
        message: 'Session is no longer active.',
      });
    }

    const tokens = this.generateTokens(
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

    const session = this.sessionStore.touch(payload.sessionId);
    if (!session || session.userId !== payload.sub) {
      throw new UnauthorizedException({
        code: 'SESSION_NOT_ACTIVE',
        message: 'Session is not active.',
      });
    }

    const user = this.usersService.findUserRecordById(payload.sub);
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

  listSessions(
    userId: string,
  ): Omit<SessionRecord, 'refreshToken' | 'userId'>[] {
    return this.sessionStore
      .listByUser(userId)
      .map(({ refreshToken: _refreshToken, userId: _userId, ...rest }) => ({
        ...rest,
      }));
  }

  revokeSession(
    userId: string,
    sessionId: string,
    traceId: string | undefined,
  ) {
    const session = this.sessionStore
      .listByUser(userId)
      .find((record) => record.id === sessionId);
    if (!session) {
      throw new NotFoundException({
        code: 'SESSION_NOT_FOUND',
        message: 'Session could not be found for the user.',
      });
    }
    this.sessionStore.revoke(sessionId);
    this.auditService.record('auth.session.revoked', {
      userId,
      traceId,
      metadata: { sessionId },
    });
  }

  private generateTokens(
    userId: string,
    email: string,
    roles: string[],
    session: SessionRecord,
  ): SignedTokens {
    const activeSession = this.sessionStore.touch(session.id) ?? session;
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
