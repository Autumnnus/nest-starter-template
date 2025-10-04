import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  RATE_LIMIT_OPTIONS_KEY,
  RateLimitOptions,
} from 'src/common/decorators/rate-limit.decorator';
import {
  RateLimitCheckResult,
  RateLimitService,
} from 'src/common/services/rate-limit.service';

import type { Request, Response } from 'express';

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rateLimitService: RateLimitService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const options = this.reflector.getAllAndOverride<RateLimitOptions>(
      RATE_LIMIT_OPTIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    const config: RateLimitOptions = {
      limit: Math.max(1, options?.limit ?? 60),
      windowSec: Math.max(1, options?.windowSec ?? 60),
      strategy: options?.strategy ?? 'fixed',
      subjects: options?.subjects,
    };

    const routeKey = this.buildRouteKey(request);
    const subjects = this.resolveSubjects(context, config.subjects);

    if (subjects.size === 0) {
      subjects.add('anonymous');
    }

    const scopeResults: RateLimitCheckResult[] = [];
    const scopeKeys = Array.from(subjects).map((subject) =>
      this.buildScopeKey(routeKey, subject),
    );

    for (const scopeKey of scopeKeys) {
      const result = await this.rateLimitService.checkRateLimit(
        scopeKey,
        config,
      );
      scopeResults.push(result);
    }

    const limit = config.limit;
    const remaining = Math.min(
      ...scopeResults.map((result) => result.remaining),
    );
    const reset = Math.max(...scopeResults.map((result) => result.ttlSec));
    response.setHeader('X-RateLimit-Limit', limit.toString());
    response.setHeader(
      'X-RateLimit-Remaining',
      Math.max(0, remaining).toString(),
    );
    response.setHeader('X-RateLimit-Reset', Math.max(0, reset).toString());

    const exceededScopes = scopeResults.filter((result) => !result.allowed);
    if (exceededScopes.length > 0) {
      const retryAfter = Math.max(
        ...exceededScopes.map((result) => result.retryAfterSec ?? reset),
      );
      response.setHeader('Retry-After', Math.max(1, retryAfter).toString());

      throw new BadRequestException({
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please try again later.',
      });
    }

    return true;
  }

  private buildRouteKey(request: Request): string {
    const method = (request.method ?? 'UNKNOWN').toUpperCase();
    const rawRoute =
      request.route?.path ??
      request.baseUrl ??
      request.originalUrl ??
      request.url ??
      'unknown';

    return this.normalizeForKey(`${method}-${rawRoute}`);
  }

  private buildScopeKey(routeKey: string, subject: string): string {
    return `rl:${routeKey}:${this.normalizeForKey(subject)}`;
  }

  private resolveSubjects(
    context: ExecutionContext,
    subjects?: RateLimitOptions['subjects'],
  ): Set<string> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const resolved = new Set<string>();
    const candidateSubjects = subjects ?? ['ip', 'user'];

    for (const subject of candidateSubjects) {
      if (subject === 'ip') {
        const ip = this.extractClientIp(request);
        if (ip) {
          resolved.add(`ip-${ip}`);
        }

        continue;
      }

      if (subject === 'user') {
        const userId = (
          request as Request & { user?: { id?: string | number } }
        ).user?.id;
        if (userId !== undefined && userId !== null) {
          resolved.add(`user-${userId}`);
        }

        continue;
      }

      if (typeof subject === 'object') {
        if (subject.type === 'header') {
          const headerKey = subject.name.toLowerCase();
          const headerValue = request.headers[headerKey];
          if (
            typeof headerValue === 'string' &&
            headerValue.trim().length > 0
          ) {
            resolved.add(`${subject.name}-${headerValue}`);
          }

          continue;
        }

        if (subject.type === 'constant') {
          resolved.add(subject.value);
          continue;
        }

        if (subject.type === 'custom') {
          const value = subject.extractor(context);
          if (value) {
            resolved.add(value);
          }
        }
      }
    }

    return resolved;
  }

  private extractClientIp(request: Request): string | undefined {
    const forwarded = request.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) {
      return forwarded.split(',')[0]?.trim();
    }

    if (Array.isArray(forwarded) && forwarded.length > 0) {
      return forwarded[0];
    }

    if (typeof request.ip === 'string' && request.ip.length > 0) {
      return request.ip;
    }

    const remoteAddress =
      ((request.connection as any)?.remoteAddress as string | undefined) ??
      ((request.socket as any)?.remoteAddress as string | undefined);

    return remoteAddress ?? undefined;
  }

  private normalizeForKey(value: string): string {
    return (
      value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-{2,}/g, '-')
        .trim() || 'unknown'
    );
  }
}
