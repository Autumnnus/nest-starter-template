import { SetMetadata } from '@nestjs/common';

import type { ExecutionContext } from '@nestjs/common';

export type RateLimitStrategy = 'fixed' | 'sliding';

export type RateLimitSubject =
  | 'ip'
  | 'user'
  | { type: 'header'; name: string }
  | { type: 'constant'; value: string }
  | {
      type: 'custom';
      extractor: (context: ExecutionContext) => string | undefined;
    };

export interface RateLimitOptions {
  limit: number;
  windowSec: number;
  strategy?: RateLimitStrategy;
  subjects?: RateLimitSubject[];
}

export const RATE_LIMIT_OPTIONS_KEY = 'rateLimitOptions';

export const RateLimit = (options: RateLimitOptions) =>
  SetMetadata(RATE_LIMIT_OPTIONS_KEY, options);
