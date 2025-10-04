import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Redis from 'ioredis';

import { RedisService } from 'src/redis/redis.service';

interface CacheKeyParts {
  entity: string;
  id: string | number;
  appName?: string;
  environment?: string;
}

interface CacheSetOptions {
  ttlSeconds?: number;
}

interface CacheOrSetOptions<T> extends CacheKeyParts {
  loader: () => Promise<T | null>;
  ttlSeconds?: number;
}

@Injectable()
export class CacheService {
  private static readonly DEFAULT_TTL_SECONDS = 30 * 60; // 30 minutes
  private static readonly MIN_TTL_SECONDS = 5 * 60; // 5 minutes
  private static readonly MAX_TTL_SECONDS = 60 * 60; // 60 minutes

  private readonly logger = new Logger(CacheService.name);
  private readonly redisClient: Redis;
  private readonly appName: string;
  private readonly environment: string;

  constructor(
    redisService: RedisService,
    private readonly configService: ConfigService,
  ) {
    this.redisClient = redisService.getClient();
    this.appName =
      this.configService.get<string>('APP_NAME')?.toLowerCase() ?? 'app';
    this.environment =
      this.configService.get<string>('NODE_ENV')?.toLowerCase() ?? 'local';
  }

  buildKey(parts: CacheKeyParts): string {
    const app = (parts.appName ?? this.appName).trim();
    const env = (parts.environment ?? this.environment).trim();
    const entity = parts.entity.trim().toLowerCase();
    const id = String(parts.id);

    return `${app}:${env}:${entity}:${id}`;
  }

  async get<T>(parts: CacheKeyParts): Promise<T | null> {
    const key = this.buildKey(parts);
    const payload = await this.redisClient.get(key);
    if (!payload) {
      return null;
    }

    try {
      return JSON.parse(payload) as T;
    } catch (error) {
      this.logger.warn(
        `Failed to parse cache entry for key ${key}. Removing corrupted value.`,
      );
      await this.redisClient.del(key);
      return null;
    }
  }

  async set<T>(
    parts: CacheKeyParts,
    value: T,
    options?: CacheSetOptions,
  ): Promise<void> {
    const key = this.buildKey(parts);
    const ttl = this.resolveTtlSeconds(options?.ttlSeconds);
    const payload = JSON.stringify(value);

    await this.redisClient.set(key, payload, 'EX', ttl);
  }

  async delete(parts: CacheKeyParts): Promise<void> {
    const key = this.buildKey(parts);
    await this.redisClient.del(key);
  }

  async getOrSet<T>(options: CacheOrSetOptions<T>): Promise<T | null> {
    const cached = await this.get<T>(options);
    if (cached !== null) {
      return cached;
    }

    const value = await options.loader();
    if (value === null) {
      return null;
    }

    await this.set(options, value, { ttlSeconds: options.ttlSeconds });
    return value;
  }

  private resolveTtlSeconds(ttlSeconds?: number): number {
    const base = this.clampTtlSeconds(
      ttlSeconds ?? CacheService.DEFAULT_TTL_SECONDS,
    );
    const jitterWindow = Math.max(1, Math.round(base * 0.1));
    const min = Math.max(1, base - jitterWindow);
    const max = base + jitterWindow;

    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private clampTtlSeconds(ttlSeconds: number): number {
    return Math.min(
      CacheService.MAX_TTL_SECONDS,
      Math.max(CacheService.MIN_TTL_SECONDS, Math.floor(ttlSeconds)),
    );
  }
}
