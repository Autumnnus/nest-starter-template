import { Client } from '@elastic/elasticsearch';
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { ElasticsearchConfig } from 'src/config/elasticsearch.config';
import { ApplicationLogMessage } from 'src/logging/interfaces/log-message.interface';

@Injectable()
export class ElasticsearchLogService implements OnModuleDestroy {
  private readonly client: Client;
  private readonly index: string;

  constructor(
    configService: ConfigService,
    private readonly logger: PinoLogger,
  ) {
    const config = configService.get<ElasticsearchConfig>('elasticsearch');
    if (!config) {
      throw new Error('Elasticsearch configuration is not available');
    }

    const auth =
      config.username && config.password
        ? { username: config.username, password: config.password }
        : undefined;
    this.client = new Client({
      node: config.node,
      auth,
      requestTimeout: config.requestTimeoutMs,
    });
    this.index = config.applicationLogIndex;
    this.logger.setContext(ElasticsearchLogService.name);
  }

  async indexLog(message: ApplicationLogMessage): Promise<void> {
    try {
      await this.client.index({
        index: this.index,
        document: message,
      });
    } catch (error: unknown) {
      this.logger.error(
        { err: error, message },
        'Failed to index application log in Elasticsearch',
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.close();
  }
}
