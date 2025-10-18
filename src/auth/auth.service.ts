import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, createHmac, createVerify, randomBytes } from 'crypto';
import { request as httpsRequest } from 'https';
import { ChangePasswordDto } from 'src/auth/dto/change-password.dto';
import { ConfirmEmailChangeDto } from 'src/auth/dto/confirm-email-change.dto';
import { GoogleOAuthLoginDto } from 'src/auth/dto/google-oauth-login.dto';
import { LoginDto } from 'src/auth/dto/login.dto';
import { RefreshTokenDto } from 'src/auth/dto/refresh-token.dto';
import { RequestEmailChangeDto } from 'src/auth/dto/request-email-change.dto';
import { RequestPasswordResetDto } from 'src/auth/dto/request-password-reset.dto';
import { ResetPasswordDto } from 'src/auth/dto/reset-password.dto';
import { EmailChangeRequestRepository } from 'src/auth/infrastructure/repositories/email-change-request.repository';
import { PasswordResetTokenRepository } from 'src/auth/infrastructure/repositories/password-reset-token.repository';
import { SessionRecord, SessionStore } from 'src/auth/session.store';
import { AuditService } from 'src/common/services/audit.service';
import { Role } from 'src/common/types/role.enum';
import { MailService } from 'src/mail/mail.service';
import { UsersService } from 'src/users/users.service';

interface JwtPayload {
  sub: string;
  email: string;
  roles: string[];
  sessionId: string;
  iat: number;
  exp: number;
}

interface GoogleIdTokenPayload {
  aud: string;
  iss: string;
  exp: number;
  email?: string;
  email_verified?: boolean;
  name?: string;
  locale?: string;
  picture?: string;
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
  private readonly jwtAccessSecret =
    process.env.JWT_ACCESS_SECRET ?? 'education-platform-secret';
  private readonly jwtRefreshSecret =
    process.env.JWT_REFRESH_SECRET ?? 'education-platform-refresh-secret';
  private readonly accessTokenTtlMs = this.parseDuration(
    process.env.JWT_ACCESS_TTL ?? '15m',
  );
  private readonly refreshTokenTtlMs = this.parseDuration(
    process.env.JWT_REFRESH_TTL ?? '30d',
  );
  private readonly passwordResetTtlMs = this.parseDuration(
    process.env.AUTH_PASSWORD_RESET_TTL ?? '30m',
  );
  private readonly emailChangeTtlMs = this.parseDuration(
    process.env.AUTH_EMAIL_CHANGE_TTL ?? '2d',
  );
  private readonly googleClientId = process.env.GOOGLE_CLIENT_ID;
  private googleCertCache?: {
    certs: Record<string, string>;
    expiresAt: number;
  };

  constructor(
    private readonly usersService: UsersService,
    private readonly sessionStore: SessionStore,
    private readonly auditService: AuditService,
    private readonly passwordResetTokens: PasswordResetTokenRepository,
    private readonly emailChangeRequests: EmailChangeRequestRepository,
    private readonly mailService: MailService,
  ) {}

  private parseDuration(v: string): number {
    const m = /^(\d+)([smhd])$/.exec(v.trim());
    if (!m) throw new Error(`Invalid duration: ${v}`);

    const n = Number(m[1]);
    switch (m[2]) {
      case 's':
        return n * 1_000;
      case 'm':
        return n * 60_000;
      case 'h':
        return n * 3_600_000;
      case 'd':
        return n * 86_400_000;
      default:
        throw new Error(`Invalid duration: ${v}`);
    }
  }

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

  async loginWithGoogle(
    request: GoogleOAuthLoginDto,
    traceId: string | undefined,
    metadata: { ipAddress?: string; userAgent?: string },
  ): Promise<SignedTokens> {
    if (!this.googleClientId) {
      throw new BadRequestException({
        code: 'GOOGLE_OAUTH_NOT_CONFIGURED',
        message: 'Google OAuth yapılandırılmamış.',
      });
    }

    const payload = await this.verifyGoogleIdToken(request.idToken);
    if (!payload.email) {
      throw new UnauthorizedException({
        code: 'GOOGLE_OAUTH_EMAIL_MISSING',
        message: 'Google hesabından e-posta bilgisi alınamadı.',
      });
    }

    if (payload.email_verified === false) {
      throw new UnauthorizedException({
        code: 'GOOGLE_EMAIL_NOT_VERIFIED',
        message: 'Google e-posta adresi doğrulanmamış.',
      });
    }

    const user = await this.usersService.createOAuthUser({
      email: payload.email,
      displayName: payload.name ?? undefined,
      locale: payload.locale ?? undefined,
    });

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

    this.auditService.record('auth.login.google', {
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

  async requestPasswordReset(
    request: RequestPasswordResetDto,
    traceId: string | undefined,
    metadata: { ipAddress?: string; userAgent?: string },
  ): Promise<{ status: 'email_sent' }> {
    const user = await this.usersService.findUserRecordByEmail(request.email);
    if (!user) {
      this.auditService.record('auth.password.reset.requested', {
        traceId,
        metadata: {
          email: request.email,
          found: false,
          ipAddress: metadata.ipAddress,
        },
      });
      return { status: 'email_sent' };
    }

    await this.passwordResetTokens.invalidateForUser(user.id);
    const { token, hash } = this.generateToken('pr');
    const expiresAt = new Date(Date.now() + this.passwordResetTtlMs);
    await this.passwordResetTokens.createToken(user.id, hash, expiresAt);

    await this.mailService.sendPasswordResetEmail({
      to: user.email,
      token,
      expiresAt,
    });

    this.auditService.record('auth.password.reset.requested', {
      userId: user.id,
      traceId,
      metadata: {
        tokenExpiresAt: expiresAt.toISOString(),
        ipAddress: metadata.ipAddress,
      },
    });

    return { status: 'email_sent' };
  }

  async resetPassword(
    request: ResetPasswordDto,
    traceId: string | undefined,
  ): Promise<{ status: 'password_reset' }> {
    const tokenHash = this.hashToken(request.token);
    const record =
      await this.passwordResetTokens.findValidByTokenHash(tokenHash);
    if (!record) {
      throw new BadRequestException({
        code: 'INVALID_PASSWORD_RESET_TOKEN',
        message: 'Şifre sıfırlama bağlantısı geçerli değil.',
      });
    }

    if (new Date(record.expiresAt).getTime() <= Date.now()) {
      await this.passwordResetTokens.invalidateForUser(record.userId);
      throw new BadRequestException({
        code: 'PASSWORD_RESET_TOKEN_EXPIRED',
        message: 'Şifre sıfırlama bağlantısının süresi dolmuş.',
      });
    }

    await this.usersService.updatePassword(
      record.userId,
      request.newPassword,
      traceId,
      'reset',
    );
    await this.passwordResetTokens.markConsumed(record.id, new Date());
    await this.sessionStore.revokeAllForUser(record.userId);

    this.auditService.record('auth.password.reset.completed', {
      userId: record.userId,
      traceId,
    });

    return { status: 'password_reset' };
  }

  async changePassword(
    userId: string,
    request: ChangePasswordDto,
    traceId: string | undefined,
  ): Promise<{ status: 'password_changed' }> {
    const user = await this.usersService.findUserRecordById(userId);
    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'User account could not be located.',
      });
    }

    const credentialsValid = await this.usersService.validateCredentials(
      user.email,
      request.currentPassword,
    );
    if (!credentialsValid) {
      throw new BadRequestException({
        code: 'INVALID_CURRENT_PASSWORD',
        message: 'Mevcut şifre hatalı.',
      });
    }

    await this.usersService.updatePassword(
      userId,
      request.newPassword,
      traceId,
      'change',
    );
    await this.sessionStore.revokeAllForUser(userId);

    this.auditService.record('auth.password.changed', {
      userId,
      traceId,
    });

    return { status: 'password_changed' };
  }

  async requestEmailChange(
    userId: string,
    request: RequestEmailChangeDto,
    traceId: string | undefined,
  ): Promise<{ status: 'verification_sent' }> {
    const user = await this.usersService.findUserRecordById(userId);
    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'User account could not be located.',
      });
    }

    if (user.email === request.newEmail) {
      throw new BadRequestException({
        code: 'EMAIL_UNCHANGED',
        message: 'Yeni e-posta adresi mevcut adres ile aynı olamaz.',
      });
    }

    const otherUser = await this.usersService.findUserRecordByEmail(
      request.newEmail,
    );
    if (otherUser && otherUser.id !== userId) {
      throw new BadRequestException({
        code: 'EMAIL_ALREADY_IN_USE',
        message:
          'Bu e-posta adresi başka bir kullanıcı tarafından kullanılıyor.',
      });
    }

    await this.emailChangeRequests.invalidateOpenRequests(userId);
    const { token, hash } = this.generateToken('ec');
    const expiresAt = new Date(Date.now() + this.emailChangeTtlMs);
    await this.emailChangeRequests.createRequest(
      userId,
      request.newEmail,
      hash,
      expiresAt,
    );

    await this.mailService.sendEmailChangeVerification({
      to: request.newEmail,
      token,
      expiresAt,
      currentEmail: user.email,
    });

    this.auditService.record('auth.email.change.requested', {
      userId,
      traceId,
      metadata: {
        newEmail: request.newEmail,
        tokenExpiresAt: expiresAt.toISOString(),
      },
    });

    return { status: 'verification_sent' };
  }

  async confirmEmailChange(
    request: ConfirmEmailChangeDto,
    traceId: string | undefined,
  ): Promise<{ status: 'email_updated'; email: string }> {
    const tokenHash = this.hashToken(request.token);
    const record =
      await this.emailChangeRequests.findValidByTokenHash(tokenHash);
    if (!record) {
      throw new BadRequestException({
        code: 'INVALID_EMAIL_CHANGE_TOKEN',
        message: 'E-posta doğrulama bağlantısı geçerli değil.',
      });
    }

    if (new Date(record.expiresAt).getTime() <= Date.now()) {
      await this.emailChangeRequests.invalidateOpenRequests(record.userId);
      throw new BadRequestException({
        code: 'EMAIL_CHANGE_TOKEN_EXPIRED',
        message: 'E-posta doğrulama bağlantısının süresi dolmuş.',
      });
    }

    const updatedUser = await this.usersService.updateEmail(
      record.userId,
      record.newEmail,
      traceId,
    );
    await this.emailChangeRequests.markConfirmed(record.id, new Date());
    await this.sessionStore.revokeAllForUser(record.userId);

    this.auditService.record('auth.email.change.confirmed', {
      userId: record.userId,
      traceId,
      metadata: {
        newEmail: record.newEmail,
      },
    });

    return { status: 'email_updated', email: updatedUser.email };
  }

  private async verifyGoogleIdToken(
    idToken: string,
  ): Promise<GoogleIdTokenPayload> {
    const segments = idToken.split('.');
    if (segments.length !== 3) {
      throw new UnauthorizedException({
        code: 'GOOGLE_TOKEN_MALFORMED',
        message: 'Google ID token formatı hatalı.',
      });
    }

    let header: { alg: string; kid?: string };
    let payload: GoogleIdTokenPayload;
    try {
      header = JSON.parse(
        Buffer.from(segments[0], 'base64url').toString('utf8'),
      ) as { alg: string; kid?: string };
      payload = JSON.parse(
        Buffer.from(segments[1], 'base64url').toString('utf8'),
      ) as GoogleIdTokenPayload;
    } catch {
      throw new UnauthorizedException({
        code: 'GOOGLE_TOKEN_DECODE_FAILED',
        message: 'Google ID token çözümlenemedi.',
      });
    }

    if (header.alg !== 'RS256') {
      throw new UnauthorizedException({
        code: 'GOOGLE_TOKEN_UNSUPPORTED_ALG',
        message: 'Desteklenmeyen Google ID token algoritması.',
      });
    }

    if (!this.googleClientId) {
      throw new BadRequestException({
        code: 'GOOGLE_OAUTH_NOT_CONFIGURED',
        message: 'Google OAuth yapılandırılmamış.',
      });
    }

    if (payload.aud !== this.googleClientId) {
      throw new UnauthorizedException({
        code: 'GOOGLE_TOKEN_INVALID_AUDIENCE',
        message: 'Google ID token bu uygulamaya ait değil.',
      });
    }

    const issuerAllowed =
      payload.iss === 'https://accounts.google.com' ||
      payload.iss === 'accounts.google.com';
    if (!issuerAllowed) {
      throw new UnauthorizedException({
        code: 'GOOGLE_TOKEN_INVALID_ISSUER',
        message: 'Google ID token geçersiz sağlayıcı tarafından imzalanmış.',
      });
    }

    if (!payload.exp || payload.exp * 1000 <= Date.now()) {
      throw new UnauthorizedException({
        code: 'GOOGLE_TOKEN_EXPIRED',
        message: 'Google ID token süresi dolmuş.',
      });
    }

    let certs: Record<string, string>;
    try {
      certs = await this.getGoogleCertificates();
    } catch {
      throw new UnauthorizedException({
        code: 'GOOGLE_CERT_FETCH_FAILED',
        message: 'Google doğrulama anahtarları alınamadı.',
      });
    }

    const certificate = header.kid ? certs[header.kid] : undefined;
    if (!certificate) {
      throw new UnauthorizedException({
        code: 'GOOGLE_CERT_NOT_FOUND',
        message: 'Google doğrulama anahtarı bulunamadı.',
      });
    }

    const verifier = createVerify('RSA-SHA256');
    verifier.update(`${segments[0]}.${segments[1]}`);
    verifier.end();

    const signatureValid = verifier.verify(
      certificate,
      Buffer.from(segments[2], 'base64url'),
    );
    if (!signatureValid) {
      throw new UnauthorizedException({
        code: 'GOOGLE_TOKEN_INVALID_SIGNATURE',
        message: 'Google ID token imzası doğrulanamadı.',
      });
    }

    return payload;
  }

  private async getGoogleCertificates(): Promise<Record<string, string>> {
    if (this.googleCertCache && this.googleCertCache.expiresAt > Date.now()) {
      return this.googleCertCache.certs;
    }

    const { certs, cacheControl, expires } =
      await this.fetchGoogleCertificates();
    const cacheTtl = this.parseCacheControl(cacheControl);
    const expiresFromHeader = Array.isArray(expires) ? expires[0] : expires;
    const computedTtl = cacheTtl
      ? cacheTtl
      : expiresFromHeader
        ? Math.max(1, (Date.parse(expiresFromHeader) - Date.now()) / 1000)
        : 3600;

    const expiresAt = Date.now() + Math.max(1, Math.floor(computedTtl)) * 1000;
    this.googleCertCache = { certs, expiresAt };
    return certs;
  }

  private async fetchGoogleCertificates(): Promise<{
    certs: Record<string, string>;
    cacheControl?: string | string[];
    expires?: string | string[];
  }> {
    return new Promise((resolve, reject) => {
      const req = httpsRequest(
        'https://www.googleapis.com/oauth2/v1/certs',
        (res) => {
          if ((res.statusCode ?? 500) >= 400) {
            reject(
              new Error(
                `Google sertifikaları alınamadı (status: ${res.statusCode})`,
              ),
            );
            res.resume();
            return;
          }

          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          });
          res.on('end', () => {
            try {
              const payload = Buffer.concat(chunks).toString('utf8');
              const certs = JSON.parse(payload) as Record<string, string>;
              resolve({
                certs,
                cacheControl: res.headers['cache-control'],
                expires: res.headers.expires,
              });
            } catch (error) {
              reject(
                error instanceof Error
                  ? error
                  : new Error(String(error ?? 'Unknown error')),
              );
            }
          });
        },
      );

      req.on('error', (error) => {
        reject(error instanceof Error ? error : new Error(String(error)));
      });
      req.end();
    });
  }

  private parseCacheControl(header?: string | string[]): number | undefined {
    if (!header) {
      return undefined;
    }

    const value = Array.isArray(header) ? header[0] : header;
    const match = /max-age=(\d+)/.exec(value);
    return match ? Number(match[1]) : undefined;
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

  private generateToken(prefix: string): { token: string; hash: string } {
    const random = randomBytes(32).toString('hex');
    const token = `${prefix}_${random}`;
    return { token, hash: this.hashToken(token) };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
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
    return createHmac('sha256', this.jwtAccessSecret)
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
