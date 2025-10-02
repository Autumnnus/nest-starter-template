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
import { LoginDto } from 'src/auth/dto/login.dto';
import { RefreshTokenDto } from 'src/auth/dto/refresh-token.dto';
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
  @RateLimit({ limit: 5, windowMs: 60_000 })
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
  @Post(ROUTES.auth.refresh)
  @Idempotent()
  @RateLimit({ limit: 10, windowMs: 60_000 })
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
  @RateLimit({ limit: 30, windowMs: 60_000 })
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
