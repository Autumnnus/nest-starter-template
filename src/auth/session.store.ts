import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { AuthSessionEntity } from 'src/auth/infrastructure/entities/auth-session.entity';
import { SessionDeviceInfo } from 'src/auth/domain/session.types';

export interface SessionRecord {
  id: string;
  userId: string;
  refreshToken: string;
  createdAt: string;
  expiresAt: string;
  lastAccessedAt: string;
  device?: SessionDeviceInfo;
}

@Injectable()
export class SessionStore {
  constructor(
    @InjectRepository(AuthSessionEntity)
    private readonly repository: Repository<AuthSessionEntity>,
  ) {}

  async create(
    userId: string,
    ttlMs: number,
    device?: SessionDeviceInfo,
  ): Promise<SessionRecord> {
    const now = new Date();
    const entity = this.repository.create({
      userId,
      refreshToken: randomBytes(48).toString('hex'),
      expiresAt: new Date(now.getTime() + ttlMs),
      lastAccessedAt: now,
      device,
    });

    const saved = await this.repository.save(entity);
    return this.toRecord(saved);
  }

  async findByRefreshToken(refreshToken: string): Promise<SessionRecord | null> {
    const entity = await this.repository.findOne({
      where: { refreshToken },
    });

    return entity ? this.toRecord(entity) : null;
  }

  async rotateRefreshToken(
    sessionId: string,
    ttlMs: number,
  ): Promise<SessionRecord | null> {
    const entity = await this.repository.findOne({ where: { id: sessionId } });
    if (!entity) {
      return null;
    }

    entity.refreshToken = randomBytes(48).toString('hex');
    entity.expiresAt = new Date(Date.now() + ttlMs);
    entity.lastAccessedAt = new Date();
    const saved = await this.repository.save(entity);
    return this.toRecord(saved);
  }

  async touch(sessionId: string): Promise<SessionRecord | null> {
    const entity = await this.repository.findOne({ where: { id: sessionId } });
    if (!entity) {
      return null;
    }

    entity.lastAccessedAt = new Date();
    const saved = await this.repository.save(entity);
    return this.toRecord(saved);
  }

  async revoke(sessionId: string): Promise<void> {
    await this.repository.delete({ id: sessionId });
  }

  async listByUser(userId: string): Promise<SessionRecord[]> {
    const entities = await this.repository.find({
      where: { userId },
      order: { lastAccessedAt: 'DESC' },
    });

    return entities.map((session) => this.toRecord(session));
  }

  async findOwnedBy(
    userId: string,
    sessionId: string,
  ): Promise<SessionRecord | null> {
    const entity = await this.repository.findOne({
      where: { id: sessionId, userId },
    });

    return entity ? this.toRecord(entity) : null;
  }

  private toRecord(entity: AuthSessionEntity): SessionRecord {
    return {
      id: entity.id,
      userId: entity.userId,
      refreshToken: entity.refreshToken,
      createdAt: entity.createdAt.toISOString(),
      expiresAt: entity.expiresAt.toISOString(),
      lastAccessedAt: entity.lastAccessedAt.toISOString(),
      device: entity.device,
    };
  }
}
