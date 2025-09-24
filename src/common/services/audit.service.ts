import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';

export interface AuditRecord {
  id: string;
  event: string;
  timestamp: string;
  userId?: string;
  traceId?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  private readonly records: AuditRecord[] = [];

  record(
    event: string,
    details: {
      userId?: string;
      traceId?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    const entry: AuditRecord = {
      id: randomUUID(),
      event,
      timestamp: new Date().toISOString(),
      userId: details.userId,
      traceId: details.traceId,
      metadata: details.metadata,
    };
    this.records.push(entry);
    this.logger.log(
      `AUDIT: ${event} ${JSON.stringify({ userId: entry.userId, traceId: entry.traceId })}`,
    );
  }

  findAll(): AuditRecord[] {
    return [...this.records];
  }
}
