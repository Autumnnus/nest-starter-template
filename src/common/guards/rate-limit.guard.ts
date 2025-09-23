import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  ApiError,
  AuthenticatedUser,
} from 'src/auth/interfaces/authenticated-user.interface';
import {
  RATE_LIMIT_OPTIONS_KEY,
  RateLimitOptions,
} from 'src/common/decorators/rate-limit.decorator';
import { RateLimitService } from 'src/common/services/rate-limit.service';

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rateLimitService: RateLimitService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const http = context.switchToHttp();
    const request = http.getRequest<AuthenticatedUser>();
    const response = http.getResponse<ApiError>();
    const user = request.user;

    const options = this.reflector.getAllAndOverride<RateLimitOptions>(
      RATE_LIMIT_OPTIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    const config: RateLimitOptions = options ?? { limit: 60, windowMs: 60_000 };

    const keys = new Set<string>();
    const endpointKey = `${request.method.toUpperCase()}:${request.baseUrl || ''}${request.path || request.url}`;
    keys.add(`endpoint:${endpointKey}`);

    const ip =
      (request.ip as string) || request.connection?.remoteAddress || 'unknown';
    keys.add(`ip:${ip}`);

    const deviceId = request.headers['x-device-id'];
    if (typeof deviceId === 'string' && deviceId.trim().length > 0) {
      keys.add(`device:${deviceId}`);
    }

    if (user) {
      keys.add(`user:${user.id}`);
      keys.add(`session:${user.sessionId}`);
    }

    let retryAfter: number | undefined;

    for (const key of keys) {
      const result = this.rateLimitService.consume(key, config);
      if (!result.allowed) {
        retryAfter = Math.max(retryAfter ?? 0, result.retryAfterSeconds ?? 1);
      }
    }

    if (retryAfter !== undefined) {
      response.setHeader('Retry-After', retryAfter.toString());
      throw new BadRequestException({
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please try again later.',
      });
    }

    return true;
  }
}
