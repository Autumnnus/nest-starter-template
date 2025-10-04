import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from 'src/redis/redis.service';

type PresenceStatus = 'online' | 'offline';

@Injectable()
export class PresenceService {
  private static readonly PRESENCE_PREFIX = 'presence:';
  private static readonly ONLINE_VALUE: PresenceStatus = 'online';

  private readonly logger = new Logger(PresenceService.name);

  constructor(private readonly redisService: RedisService) {}

  async presencePing(
    userId: string | number,
    ttlSec: number = 30,
  ): Promise<void> {
    const normalizedUserId = this.normalizeUserId(userId);
    const ttl = this.normalizeTtl(ttlSec);

    try {
      const client = this.redisService.getClient();
      await client.setex(
        this.buildPresenceKey(normalizedUserId),
        ttl,
        PresenceService.ONLINE_VALUE,
      );
    } catch (error) {
      this.logger.error(
        `Failed to refresh presence for user ${normalizedUserId}`,
        error as Error,
      );
      throw error;
    }
  }

  async getPresence(
    userIds: ReadonlyArray<string | number>,
  ): Promise<Record<string, PresenceStatus>> {
    if (userIds.length === 0) {
      return {};
    }

    const normalizedUserIds = Array.from(
      new Set(userIds.map((userId) => this.normalizeUserId(userId))),
    );

    const client = this.redisService.getClient();
    const pipeline = client.pipeline();

    normalizedUserIds.forEach((userId) => {
      pipeline.get(this.buildPresenceKey(userId));
    });

    const results = await pipeline.exec();

    if (!results) {
      throw new Error('Failed to fetch presence states from Redis');
    }

    const presence: Record<string, PresenceStatus> = {};

    results.forEach(([error, value], index) => {
      const userId = normalizedUserIds[index];

      if (error) {
        this.logger.error(`Failed to read presence for user ${userId}`, error);
        throw error;
      }

      presence[userId] =
        value === PresenceService.ONLINE_VALUE ? 'online' : 'offline';
    });

    return presence;
  }

  private buildPresenceKey(userId: string): string {
    return `${PresenceService.PRESENCE_PREFIX}${userId}`;
  }

  private normalizeUserId(userId: string | number): string {
    const normalized = String(userId).trim();

    if (!normalized) {
      throw new Error('userId must be a non-empty string');
    }

    return normalized;
  }

  private normalizeTtl(ttlSec: number): number {
    if (!Number.isFinite(ttlSec)) {
      throw new Error('ttlSec must be a finite number');
    }

    const ttl = Math.floor(ttlSec);

    if (ttl <= 0) {
      throw new Error('ttlSec must be greater than 0');
    }

    return ttl;
  }
}

export type { PresenceStatus };
