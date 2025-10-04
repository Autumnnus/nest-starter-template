import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PinoLogger } from 'nestjs-pino';
import { AuditLogEntity } from 'src/logging/entities/audit-log.entity';
import { AuditLogMessage } from 'src/logging/interfaces/log-message.interface';
import { Repository } from 'typeorm';

@Injectable()
export class AuditLogWriterService {
  constructor(
    @InjectRepository(AuditLogEntity)
    private readonly repository: Repository<AuditLogEntity>,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(AuditLogWriterService.name);
  }

  async persist(message: AuditLogMessage): Promise<void> {
    try {
      const entity = this.repository.create({
        event: message.event,
        userId: message.userId ?? null,
        traceId: message.traceId ?? null,
        metadata: message.metadata ?? null,
        method: message.context?.method ?? null,
        path: message.context?.path ?? null,
        statusCode: message.context?.statusCode ?? null,
        ipAddress: message.context?.ipAddress ?? null,
        userAgent: message.context?.userAgent ?? null,
        responseTimeMs: message.context?.responseTimeMs ?? null,
        createdAt: new Date(message.occurredAt),
      });
      await this.repository.save(entity);
    } catch (error: unknown) {
      this.logger.error(
        { err: error, message },
        'Failed to persist audit log entry',
      );
    }
  }
}
