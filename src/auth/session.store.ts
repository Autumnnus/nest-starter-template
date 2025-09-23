import { Injectable } from '@nestjs/common';
import { randomBytes, randomUUID } from 'crypto';

export interface SessionDeviceInfo {
  deviceId?: string;
  deviceName?: string;
  ipAddress?: string;
  userAgent?: string;
}

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
  private readonly sessions = new Map<string, SessionRecord>();
  private readonly refreshTokenIndex = new Map<string, string>();

  create(
    userId: string,
    ttlMs: number,
    device?: SessionDeviceInfo,
  ): SessionRecord {
    const id = randomUUID();
    const now = new Date();
    const refreshToken = randomBytes(48).toString('hex');
    const record: SessionRecord = {
      id,
      userId,
      refreshToken,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
      lastAccessedAt: now.toISOString(),
      device,
    };
    this.sessions.set(id, record);
    this.refreshTokenIndex.set(record.refreshToken, id);
    return record;
  }

  findByRefreshToken(refreshToken: string): SessionRecord | undefined {
    const sessionId = this.refreshTokenIndex.get(refreshToken);
    if (!sessionId) {
      return undefined;
    }
    return this.sessions.get(sessionId);
  }

  rotateRefreshToken(
    sessionId: string,
    ttlMs: number,
  ): SessionRecord | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return undefined;
    }
    this.refreshTokenIndex.delete(session.refreshToken);
    const newToken = randomBytes(48).toString('hex');
    session.refreshToken = newToken;
    session.expiresAt = new Date(Date.now() + ttlMs).toISOString();
    session.lastAccessedAt = new Date().toISOString();
    this.refreshTokenIndex.set(newToken, sessionId);
    return session;
  }

  touch(sessionId: string): SessionRecord | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return undefined;
    }
    session.lastAccessedAt = new Date().toISOString();
    return session;
  }

  revoke(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }
    this.sessions.delete(sessionId);
    this.refreshTokenIndex.delete(session.refreshToken);
  }

  listByUser(userId: string): SessionRecord[] {
    return [...this.sessions.values()].filter(
      (session) => session.userId === userId,
    );
  }
}
