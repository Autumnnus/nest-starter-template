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
import { AuthService, SignedTokens } from 'src/auth/auth.service';
import { validateLoginRequest } from 'src/auth/dto/login.dto';
import { validateRefreshTokenRequest } from 'src/auth/dto/refresh-token.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Idempotent } from 'src/common/decorators/idempotent.decorator';
import { Public } from 'src/common/decorators/public.decorator';
import { RateLimit } from 'src/common/decorators/rate-limit.decorator';

import type { Request } from 'express';
import type { IUser } from 'src/auth/interfaces/authenticated-user.interface';

@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @Idempotent()
  @RateLimit({ limit: 5, windowMs: 60_000 })
  async login(
    @Body() body: unknown,
    @Req() request: Request,
  ): Promise<SignedTokens> {
    const payload = validateLoginRequest(body);
    const tokens = await this.authService.login(payload, request.traceId, {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });
    return tokens;
  }

  @Public()
  @Post('refresh')
  @Idempotent()
  @RateLimit({ limit: 10, windowMs: 60_000 })
  async refresh(@Body() body: unknown, @Req() request: Request) {
    const payload = validateRefreshTokenRequest(body);
    return this.authService.refreshTokens(payload, request.traceId);
  }

  @Get('sessions')
  sessions(@CurrentUser() user: IUser) {
    return this.authService.listSessions(user.id);
  }

  @Delete('sessions/:sessionId')
  @Idempotent()
  @RateLimit({ limit: 30, windowMs: 60_000 })
  revokeSession(
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

    this.authService.revokeSession(user.id, sessionId, request.traceId);
    return { status: 'revoked', sessionId };
  }
}
