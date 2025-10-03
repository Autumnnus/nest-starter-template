import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { lastValueFrom } from 'rxjs';
import { RABBITMQ_CLIENT } from 'src/rabbitmq/rabbitmq.constants';

import type { ClientProxy } from '@nestjs/microservices';

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMQService.name);

  constructor(@Inject(RABBITMQ_CLIENT) private readonly client: ClientProxy) {}

  async onModuleInit(): Promise<void> {
    await this.client.connect();
    this.logger.log('RabbitMQ client connected');
  }

  async emit(pattern: string, payload: unknown): Promise<void> {
    await lastValueFrom(this.client.emit(pattern, payload));
  }

  async send<TResult>(pattern: string, payload: unknown): Promise<TResult> {
    return lastValueFrom(this.client.send<TResult, unknown>(pattern, payload));
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.close();
    this.logger.log('RabbitMQ client disconnected');
  }
}
