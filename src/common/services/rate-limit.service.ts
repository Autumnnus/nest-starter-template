import { Injectable } from '@nestjs/common';
import { RateLimitOptions } from '../decorators/rate-limit.decorator';

interface TokenBucket {
  tokens: number;
  lastRefillAt: number;
}

@Injectable()
export class RateLimitService {
  private readonly buckets = new Map<string, TokenBucket>();
  private readonly defaultOptions: RateLimitOptions = {
    limit: 60,
    windowMs: 60_000,
  };

  consume(key: string, options?: RateLimitOptions): { allowed: boolean; retryAfterSeconds?: number } {
    const config = options ?? this.defaultOptions;
    const now = Date.now();
    const bucket = this.buckets.get(key) ?? {
      tokens: config.limit,
      lastRefillAt: now,
    };
    const elapsedMs = now - bucket.lastRefillAt;
    const refillRatePerMs = config.limit / config.windowMs;
    const refilledTokens = bucket.tokens + elapsedMs * refillRatePerMs;
    bucket.tokens = Math.min(config.limit, refilledTokens);
    bucket.lastRefillAt = now;

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      this.buckets.set(key, bucket);
      return { allowed: true };
    }

    const tokensNeeded = 1 - bucket.tokens;
    const waitMs = tokensNeeded / refillRatePerMs;
    const retryAfterSeconds = Math.max(1, Math.ceil(waitMs / 1000));

    this.buckets.set(key, bucket);
    return { allowed: false, retryAfterSeconds };
  }
}
