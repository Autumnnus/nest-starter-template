import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import {
  ApplicationLogMessage,
  AuditLogMessage,
} from 'src/logging/interfaces/log-message.interface';
import {
  APPLICATION_LOG_PATTERN,
  AUDIT_LOG_PATTERN,
} from 'src/logging/logging.constants';
import { RabbitMQService } from 'src/rabbitmq/rabbitmq.service';

@Injectable()
export class LoggingQueueService {
  constructor(
    private readonly rabbitMQService: RabbitMQService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(LoggingQueueService.name);
  }

  async enqueueAuditLog(message: AuditLogMessage): Promise<void> {
    try {
      await this.rabbitMQService.emit(AUDIT_LOG_PATTERN, message);
    } catch (error: unknown) {
      this.logger.error(
        { err: error, message },
        'Failed to enqueue audit log message',
      );
    }
  }

  async enqueueApplicationLog(message: ApplicationLogMessage): Promise<void> {
    try {
      await this.rabbitMQService.emit(APPLICATION_LOG_PATTERN, message);
    } catch (error: unknown) {
      this.logger.error(
        { err: error, message },
        'Failed to enqueue application log message',
      );
    }
  }
}
