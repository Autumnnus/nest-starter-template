import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import {
  ApiError,
  AuthenticatedUser,
} from 'src/auth/interfaces/authenticated-user.interface';
import { IDEMPOTENCY_REQUIRED_KEY } from '../decorators/idempotent.decorator';
import { IdempotencyService } from '../services/idempotency.service';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly service: IdempotencyService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<AuthenticatedUser>();
    const response = http.getResponse<ApiError>();

    const method = request.method.toUpperCase();
    const requiresIdempotency = this.reflector.getAllAndOverride<boolean>(
      IDEMPOTENCY_REQUIRED_KEY,
      [context.getHandler(), context.getClass()],
    );

    const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

    if (!isMutation) {
      return next.handle();
    }

    const headerValue = request.headers['idempotency-key'];
    const idempotencyKey = Array.isArray(headerValue)
      ? headerValue[0]
      : headerValue;

    if (requiresIdempotency && !idempotencyKey) {
      throw new BadRequestException({
        code: 'IDEMPOTENCY_KEY_REQUIRED',
        message: 'Idempotency-Key header is required for this endpoint.',
      });
    }

    if (!idempotencyKey || typeof idempotencyKey !== 'string') {
      return next.handle();
    }

    const cacheKey = this.service.buildCacheKey({
      idempotencyKey,
      method,
      url: request.originalUrl ?? request.url,
      userId: request.user?.id,
    });

    const cached = this.service.get(cacheKey);
    if (cached) {
      response.status(cached.statusCode);
      Object.entries(cached.headers).forEach(([header, value]) => {
        if (header.toLowerCase() === 'content-length') {
          return;
        }
        if (Array.isArray(value)) {
          response.setHeader(header, value);
        } else {
          response.setHeader(header, value);
        }
      });
      response.setHeader('X-Idempotent-Replay', 'true');
      return of(cached.body);
    }

    return next.handle().pipe(
      tap((body) => {
        const headers = response.getHeaders();
        const simplifiedHeaders: Record<string, string | string[]> = {};
        Object.entries(headers).forEach(([header, value]) => {
          if (typeof value === 'number') {
            simplifiedHeaders[header] = value.toString();
          } else {
            simplifiedHeaders[header] = value as string | string[];
          }
        });
        this.service.save(
          cacheKey,
          response.statusCode,
          body,
          simplifiedHeaders,
        );
        response.setHeader('X-Idempotent-Replay', 'false');
      }),
    );
  }
}
