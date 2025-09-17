import { Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';

interface IdempotencyRecord {
  id: string;
  cacheKey: string;
  statusCode: number;
  body: unknown;
  headers: Record<string, string | string[]>;
  createdAt: number;
  expiresAt: number;
}

export interface IdempotencyOptions {
  ttlMs?: number;
}

@Injectable()
export class IdempotencyService {
  private readonly store = new Map<string, IdempotencyRecord>();
  private readonly ttlMs: number;

  constructor(options?: IdempotencyOptions) {
    this.ttlMs = options?.ttlMs ?? 24 * 60 * 60 * 1000;
  }

  buildCacheKey(params: { idempotencyKey: string; method: string; url: string; userId?: string }): string {
    const hash = createHash('sha256');
    hash.update(params.idempotencyKey);
    hash.update('|');
    hash.update(params.method.toUpperCase());
    hash.update('|');
    hash.update(params.url);
    if (params.userId) {
      hash.update('|');
      hash.update(params.userId);
    }
    return hash.digest('hex');
  }

  get(cacheKey: string): IdempotencyRecord | undefined {
    const record = this.store.get(cacheKey);
    if (!record) {
      return undefined;
    }
    if (record.expiresAt <= Date.now()) {
      this.store.delete(cacheKey);
      return undefined;
    }
    return record;
  }

  save(cacheKey: string, statusCode: number, body: unknown, headers: Record<string, string | string[]>): IdempotencyRecord {
    const expiresAt = Date.now() + this.ttlMs;
    const record: IdempotencyRecord = {
      id: randomUUID(),
      cacheKey,
      statusCode,
      body,
      headers,
      createdAt: Date.now(),
      expiresAt,
    };
    this.store.set(cacheKey, record);
    return record;
  }
}
