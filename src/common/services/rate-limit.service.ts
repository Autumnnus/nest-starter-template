import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  RateLimitStrategy,
  RateLimitOptions,
} from 'src/common/decorators/rate-limit.decorator';
import { RedisService } from 'src/redis/redis.service';

export interface RateLimitCheckResult {
  allowed: boolean;
  totalHits: number;
  remaining: number;
  retryAfterSec?: number;
  ttlSec: number;
}

@Injectable()
export class RateLimitService {
  private readonly logger = new Logger(RateLimitService.name);

  constructor(private readonly redisService: RedisService) {}

  async checkRateLimit(
    scopeKey: string,
    options: Pick<RateLimitOptions, 'limit' | 'windowSec' | 'strategy'>,
  ): Promise<RateLimitCheckResult> {
    const strategy: RateLimitStrategy = options.strategy ?? 'fixed';

    if (strategy === 'sliding') {
      return this.checkSlidingWindow(
        scopeKey,
        options.limit,
        options.windowSec,
      );
    }

    return this.checkFixedWindow(scopeKey, options.limit, options.windowSec);
  }

  async checkFixedWindow(
    scopeKey: string,
    limit: number,
    windowSec: number,
  ): Promise<RateLimitCheckResult> {
    const redis = this.redisService.getClient();
    const now = Date.now();
    const windowSizeMs = windowSec * 1000;
    const windowStart = Math.floor(now / windowSizeMs) * windowSizeMs;
    const windowEnd = windowStart + windowSizeMs;
    const ttlMs = Math.max(1, windowEnd - now);
    const ttlSec = Math.max(1, Math.ceil(ttlMs / 1000));

    try {
      const results = await redis
        .multi()
        .incr(scopeKey)
        .pexpire(scopeKey, ttlMs)
        .exec();

      const incrResult = results?.[0]?.[1];
      const totalHits =
        typeof incrResult === 'number' ? incrResult : Number(incrResult ?? 0);
      const allowed = totalHits <= limit;
      const remaining = Math.max(0, limit - totalHits);
      const retryAfterSec = allowed ? undefined : ttlSec;

      return {
        allowed,
        totalHits,
        remaining,
        retryAfterSec,
        ttlSec,
      };
    } catch (error) {
      this.logger.error(
        `Failed to apply fixed window rate limit for ${scopeKey}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  async checkSlidingWindow(
    scopeKey: string,
    limit: number,
    windowSec: number,
  ): Promise<RateLimitCheckResult> {
    const redis = this.redisService.getClient();
    const now = Date.now();
    const windowStart = now - windowSec * 1000;
    const memberId = randomUUID();

    try {
      const results = await redis
        .multi()
        .zremrangebyscore(scopeKey, 0, windowStart)
        .zadd(scopeKey, now, memberId)
        .zcard(scopeKey)
        .zrange(scopeKey, 0, 0, 'WITHSCORES')
        .expire(scopeKey, windowSec)
        .exec();

      const totalHitsRaw = results?.[2]?.[1];
      const totalHits =
        typeof totalHitsRaw === 'number'
          ? totalHitsRaw
          : Number(totalHitsRaw ?? 0);
      const oldestEntryRaw = results?.[3]?.[1] as string[] | undefined;
      const oldestScore =
        oldestEntryRaw && oldestEntryRaw.length >= 2
          ? Number(oldestEntryRaw[1])
          : now;
      const ttlMs = windowSec * 1000 - (now - oldestScore);
      const ttlSec = Math.max(1, Math.ceil(ttlMs / 1000));
      const allowed = totalHits <= limit;
      const remaining = Math.max(0, limit - totalHits);
      const retryAfterSec = allowed ? undefined : ttlSec;

      return {
        allowed,
        totalHits,
        remaining,
        retryAfterSec,
        ttlSec,
      };
    } catch (error) {
      this.logger.error(
        `Failed to apply sliding window rate limit for ${scopeKey}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }
}
