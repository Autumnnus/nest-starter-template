import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { RABBITMQ_CLIENT } from 'src/rabbitmq/rabbitmq.constants';
import { RabbitMQService } from 'src/rabbitmq/rabbitmq.service';

import type { RabbitMQConfig } from 'src/config/rabbitmq.config';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: RABBITMQ_CLIENT,
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => {
          const rabbitConfig = configService.get<RabbitMQConfig>('rabbitmq');

          if (!rabbitConfig) {
            throw new Error('RabbitMQ configuration is not available');
          }

          return {
            transport: Transport.RMQ,
            options: {
              urls: rabbitConfig.urls,
              queue: rabbitConfig.queue,
              queueOptions: rabbitConfig.queueOptions,
              prefetchCount: rabbitConfig.prefetchCount,
              isGlobalPrefetch: rabbitConfig.isGlobalPrefetch,
            },
          };
        },
      },
    ]),
  ],
  providers: [RabbitMQService],
  exports: [ClientsModule, RabbitMQService],
})
export class RabbitMQModule {}
