import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { ApplicationLogMessage } from 'src/logging/interfaces/log-message.interface';
import { ElasticsearchLogService } from 'src/logging/services/elasticsearch-log.service';

@Injectable()
export class ApplicationLogWriterService {
  constructor(
    private readonly elasticsearchLogService: ElasticsearchLogService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(ApplicationLogWriterService.name);
  }

  async persist(message: ApplicationLogMessage): Promise<void> {
    try {
      await this.elasticsearchLogService.indexLog(message);
    } catch (error: unknown) {
      this.logger.error(
        { err: error, message },
        'Failed to persist application log entry',
      );
    }
  }
}
