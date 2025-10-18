import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
} from '@nestjs/swagger';
import { AuthService, SignedTokens } from 'src/auth/auth.service';
import { ChangePasswordDto } from 'src/auth/dto/change-password.dto';
import { ConfirmEmailChangeDto } from 'src/auth/dto/confirm-email-change.dto';
import { GoogleOAuthLoginDto } from 'src/auth/dto/google-oauth-login.dto';
import { LoginDto } from 'src/auth/dto/login.dto';
import { RefreshTokenDto } from 'src/auth/dto/refresh-token.dto';
import { RequestEmailChangeDto } from 'src/auth/dto/request-email-change.dto';
import { RequestPasswordResetDto } from 'src/auth/dto/request-password-reset.dto';
import { ResetPasswordDto } from 'src/auth/dto/reset-password.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Idempotent } from 'src/common/decorators/idempotent.decorator';
import { Public } from 'src/common/decorators/public.decorator';
import { RateLimit } from 'src/common/decorators/rate-limit.decorator';
import { ROUTES } from 'src/common/routes';

import type { Request } from 'express';
import type { IUser } from 'src/auth/interfaces/authenticated-user.interface';

@Controller(ROUTES.auth.root)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post(ROUTES.auth.login)
  @Idempotent()
  @RateLimit({ limit: 5, windowSec: 60, strategy: 'sliding' })
  @ApiOperation({
    summary: 'User login',
    description:
      'Generates access and refresh tokens using valid user credentials.',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Unique key for this request (e.g., UUID)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiOkResponse({
    description: 'Login successful',
    schema: {
      example: {
        tokenType: 'Bearer',
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        expiresIn: 900,
        refreshToken: 'rt_2fZtQm...9xA',
        session: {
          id: 'sess_01J7Z9...',
          createdAt: '2025-09-25T18:40:00.000Z',
          lastAccessedAt: '2025-09-25T18:40:00.000Z',
          expiresAt: '2025-10-25T18:40:00.000Z',
          device: { id: 'ios-uuid-123', name: 'iPhone 15 Pro' },
        },
      },
    },
  })
  async login(
    @Body() body: LoginDto,
    @Req() request: Request,
  ): Promise<SignedTokens> {
    const tokens = await this.authService.login(body, request.traceId, {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });
    return tokens;
  }

  @Public()
  @Post(ROUTES.auth.oauth.google)
  @Idempotent()
  @RateLimit({ limit: 5, windowSec: 60, strategy: 'sliding' })
  @ApiOperation({
    summary: 'Google ile giriş',
    description:
      'Google ID token kullanarak kullanıcıyı kimlik doğrular ve oturum açar.',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Bu isteğe ait benzersiz anahtar (örn. UUID)',
  })
  @ApiOkResponse({
    description: 'Google OAuth giriş başarılı',
    schema: {
      example: {
        tokenType: 'Bearer',
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        expiresIn: 900,
        refreshToken: 'rt_8nRm...1pQ',
        session: {
          id: 'sess_01J7ZD...',
          createdAt: '2025-09-25T18:40:00.000Z',
          lastAccessedAt: '2025-09-25T18:40:00.000Z',
          expiresAt: '2025-10-25T18:40:00.000Z',
          device: { id: 'android-device-123', name: 'Pixel 9' },
        },
      },
    },
  })
  async googleLogin(
    @Body() body: GoogleOAuthLoginDto,
    @Req() request: Request,
  ): Promise<SignedTokens> {
    return this.authService.loginWithGoogle(body, request.traceId, {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }

  @Public()
  @Post(ROUTES.auth.refresh)
  @Idempotent()
  @RateLimit({ limit: 10, windowSec: 60, strategy: 'sliding' })
  @ApiOperation({
    summary: 'Refresh access token',
    description: 'Generates a new access token using a valid refresh token.',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Unique key for this request (e.g., UUID)',
    example: '7b4a2a12-5c9a-4f8a-9b1f-9d0d9f8c1a11',
  })
  @ApiOkResponse({
    description: 'Refresh successful',
    schema: {
      example: {
        tokenType: 'Bearer',
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        expiresIn: 900,
        refreshToken: 'rt_7mYv...1kQ',
        session: {
          id: 'sess_01J7ZC...',
          createdAt: '2025-09-01T10:00:00.000Z',
          lastAccessedAt: '2025-09-25T18:55:00.000Z',
          expiresAt: '2025-10-25T10:00:00.000Z',
          device: { id: 'ios-uuid-123', name: 'iPhone 15 Pro' },
        },
      },
    },
  })
  async refresh(@Body() body: RefreshTokenDto, @Req() request: Request) {
    return this.authService.refreshTokens(body, request.traceId);
  }

  @Public()
  @Post(ROUTES.auth.password.requestReset)
  @Idempotent()
  @RateLimit({ limit: 3, windowSec: 300, strategy: 'fixed' })
  @ApiOperation({
    summary: 'Şifre sıfırlama talebi',
    description:
      'Geçerli bir e-posta ile şifre sıfırlama bağlantısı gönderilmesini sağlar.',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Bu isteğe ait benzersiz anahtar (örn. UUID)',
  })
  @ApiOkResponse({
    description: 'Şifre sıfırlama e-postası kuyruğa alındı',
    schema: { example: { status: 'email_sent' } },
  })
  async requestPasswordReset(
    @Body() body: RequestPasswordResetDto,
    @Req() request: Request,
  ) {
    return this.authService.requestPasswordReset(body, request.traceId, {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }

  @Public()
  @Post(ROUTES.auth.password.reset)
  @Idempotent()
  @RateLimit({ limit: 5, windowSec: 300, strategy: 'fixed' })
  @ApiOperation({
    summary: 'Şifre sıfırlama',
    description: 'Geçerli token ve yeni şifre ile hesabın şifresini günceller.',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Bu isteğe ait benzersiz anahtar (örn. UUID)',
  })
  @ApiOkResponse({
    description: 'Şifre başarıyla güncellendi',
    schema: { example: { status: 'password_reset' } },
  })
  async resetPassword(@Body() body: ResetPasswordDto, @Req() request: Request) {
    return this.authService.resetPassword(body, request.traceId);
  }

  @Post(ROUTES.auth.password.change)
  @Idempotent()
  @RateLimit({ limit: 5, windowSec: 300, strategy: 'sliding' })
  @ApiOperation({ summary: 'Şifre değiştir' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Bu isteğe ait benzersiz anahtar (örn. UUID)',
  })
  @ApiOkResponse({
    description: 'Şifre değiştirildi',
    schema: { example: { status: 'password_changed' } },
  })
  @ApiBearerAuth('JWT-auth')
  async changePassword(
    @CurrentUser() user: IUser,
    @Body() body: ChangePasswordDto,
    @Req() request: Request,
  ) {
    return this.authService.changePassword(user.id, body, request.traceId);
  }

  @Post(ROUTES.auth.email.requestChange)
  @Idempotent()
  @RateLimit({ limit: 3, windowSec: 600, strategy: 'fixed' })
  @ApiOperation({
    summary: 'E-posta değişikliği talep et',
    description: 'Yeni e-posta adresine doğrulama bağlantısı gönderir.',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Bu isteğe ait benzersiz anahtar (örn. UUID)',
  })
  @ApiOkResponse({
    description: 'Doğrulama e-postası gönderildi',
    schema: { example: { status: 'verification_sent' } },
  })
  @ApiBearerAuth('JWT-auth')
  async requestEmailChange(
    @CurrentUser() user: IUser,
    @Body() body: RequestEmailChangeDto,
    @Req() request: Request,
  ) {
    return this.authService.requestEmailChange(user.id, body, request.traceId);
  }

  @Public()
  @Post(ROUTES.auth.email.confirm)
  @Idempotent()
  @RateLimit({ limit: 5, windowSec: 600, strategy: 'fixed' })
  @ApiOperation({
    summary: 'E-posta değişikliğini doğrula',
    description: 'Geçerli doğrulama tokenı ile yeni e-posta adresini onaylar.',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Bu isteğe ait benzersiz anahtar (örn. UUID)',
  })
  @ApiOkResponse({
    description: 'E-posta güncellendi',
    schema: { example: { status: 'email_updated', email: 'new@example.com' } },
  })
  async confirmEmailChange(
    @Body() body: ConfirmEmailChangeDto,
    @Req() request: Request,
  ) {
    return this.authService.confirmEmailChange(body, request.traceId);
  }

  @Get(ROUTES.auth.sessions)
  @ApiOperation({ summary: 'List active sessions' })
  @ApiOkResponse({
    description: 'List of active sessions for the user',
    schema: {
      example: [
        {
          id: 'sess_01J7Z9...',
          createdAt: '2025-09-01T10:00:00.000Z',
          lastAccessedAt: '2025-09-25T18:40:00.000Z',
          expiresAt: '2025-10-25T10:00:00.000Z',
          device: { id: 'ios-uuid-123', name: 'iPhone 15 Pro' },
        },
      ],
    },
  })
  @ApiBearerAuth('JWT-auth')
  async sessions(@CurrentUser() user: IUser) {
    return this.authService.listSessions(user.id);
  }

  @Delete(ROUTES.auth.session)
  @Idempotent()
  @RateLimit({ limit: 30, windowSec: 60, strategy: 'fixed' })
  @ApiOperation({ summary: 'Revoke session' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Unique key for this request (e.g., UUID)',
    example: 'b2f0d9d2-2d6b-4c9b-8a9f-2f4a1c3d5e6f',
  })
  @ApiParam({
    name: 'sessionId',
    example: 'sess_01J7Z9...',
    description: 'Session ID to revoke',
  })
  @ApiOkResponse({
    description: 'Session revoked successfully',
    schema: { example: { status: 'revoked', sessionId: 'sess_01J7Z9...' } },
  })
  async revokeSession(
    @CurrentUser() user: IUser,
    @Param('sessionId') sessionId: string,
    @Req() request: Request,
  ) {
    if (!sessionId) {
      throw new BadRequestException({
        code: 'SESSION_ID_REQUIRED',
        message: 'sessionId is required.',
      });
    }

    await this.authService.revokeSession(user.id, sessionId, request.traceId);
    return { status: 'revoked', sessionId };
  }
}
