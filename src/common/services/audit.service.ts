import { Injectable } from '@nestjs/common';
import { LoggingQueueService } from 'src/logging/logging-queue.service';

@Injectable()
export class AuditService {
  constructor(private readonly loggingQueueService: LoggingQueueService) {}

  record(
    event: string,
    details: {
      userId?: string;
      traceId?: string;
      metadata?: Record<string, unknown>;
    },
  ): void {
    const occurredAt = new Date().toISOString();
    void this.loggingQueueService.enqueueAuditLog({
      event,
      occurredAt,
      userId: details.userId,
      traceId: details.traceId,
      metadata: details.metadata,
    });
  }
}
