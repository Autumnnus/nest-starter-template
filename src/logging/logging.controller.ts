import { Controller } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import { PinoLogger } from 'nestjs-pino';
import {
  APPLICATION_LOG_PATTERN,
  AUDIT_LOG_PATTERN,
} from 'src/logging/logging.constants';
import { ApplicationLogWriterService } from 'src/logging/services/application-log-writer.service';
import { AuditLogWriterService } from 'src/logging/services/audit-log-writer.service';

import type {
  ApplicationLogMessage,
  AuditLogMessage,
} from 'src/logging/interfaces/log-message.interface';

@Controller()
export class LoggingController {
  constructor(
    private readonly auditLogWriterService: AuditLogWriterService,
    private readonly applicationLogWriterService: ApplicationLogWriterService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(LoggingController.name);
  }

  @EventPattern(AUDIT_LOG_PATTERN)
  async handleAuditLog(
    @Payload() payload: AuditLogMessage,
    @Ctx() context: RmqContext,
  ): Promise<void> {
    try {
      await this.auditLogWriterService.persist(payload);
    } finally {
      this.acknowledge(context);
    }
  }

  @EventPattern(APPLICATION_LOG_PATTERN)
  async handleApplicationLog(
    @Payload() payload: ApplicationLogMessage,
    @Ctx() context: RmqContext,
  ): Promise<void> {
    try {
      await this.applicationLogWriterService.persist(payload);
    } finally {
      this.acknowledge(context);
    }
  }

  private acknowledge(context: RmqContext): void {
    try {
      const channel = context.getChannelRef();
      const originalMessage = context.getMessage();
      channel.ack(originalMessage);
    } catch (error: unknown) {
      this.logger.error(
        { err: error },
        'Failed to acknowledge RabbitMQ message',
      );
    }
  }
}
