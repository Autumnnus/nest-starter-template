import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerModule } from 'nestjs-pino';
import { AuditLogEntity } from 'src/logging/entities/audit-log.entity';
import { LoggingQueueService } from 'src/logging/logging-queue.service';
import { LoggingController } from 'src/logging/logging.controller';
import { ApplicationLogWriterService } from 'src/logging/services/application-log-writer.service';
import { AuditLogWriterService } from 'src/logging/services/audit-log-writer.service';
import { ElasticsearchLogService } from 'src/logging/services/elasticsearch-log.service';
import { RabbitMQModule } from 'src/rabbitmq/rabbitmq.module';

@Global()
@Module({
  imports: [
    ConfigModule,
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.PINO_LOG_LEVEL ?? 'info',
        genReqId: (req) =>
          (req.headers['x-request-id'] as string) ?? crypto.randomUUID(),
        customProps: (req) => ({ traceId: req.id }),
        base: undefined,
        autoLogging: false,
      },
    }),
    RabbitMQModule,
    TypeOrmModule.forFeature([AuditLogEntity]),
  ],
  controllers: [LoggingController],
  providers: [
    LoggingQueueService,
    ElasticsearchLogService,
    ApplicationLogWriterService,
    AuditLogWriterService,
  ],
  exports: [LoggingQueueService],
})
export class LoggingModule {}
