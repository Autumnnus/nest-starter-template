import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { IncomingMessage, ServerResponse } from 'http';
import { LoggerModule } from 'nestjs-pino';
import pino from 'pino';
import { AuditLogEntity } from 'src/logging/entities/audit-log.entity';
import { LoggingQueueService } from 'src/logging/logging-queue.service';
import { LoggingController } from 'src/logging/logging.controller';
import { ApplicationLogWriterService } from 'src/logging/services/application-log-writer.service';
import { AuditLogWriterService } from 'src/logging/services/audit-log-writer.service';
import { ElasticsearchLogService } from 'src/logging/services/elasticsearch-log.service';
import { RabbitMQModule } from 'src/rabbitmq/rabbitmq.module';

const isProd = process.env.NODE_ENV === 'production';

@Global()
@Module({
  imports: [
    ConfigModule,
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.PINO_LOG_LEVEL ?? 'info',
        base: undefined,
        autoLogging: false,

        // request-id üretimi
        genReqId: (req: IncomingMessage & { id?: string }) =>
          (req.headers['x-request-id'] as string | undefined) ?? randomUUID(),

        // loglara okunur alanlar ekle
        customProps: (req: IncomingMessage & { id?: string }) => ({
          traceId: req.id ?? undefined,
        }),

        // hassas verileri gizle
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'req.headers.x-api-key',
          ],
          censor: '[REDACTED]',
        },

        // stack ve minimal req/res için serializer
        serializers: {
          err: pino.stdSerializers.err,
          req: (req: IncomingMessage & { id?: string }) => ({
            id: req.id,
            method: req.method,
            url: req.url,
          }),
          res: (res: ServerResponse) => ({
            statusCode: res.statusCode,
          }),
        },
        transport: isProd
          ? undefined
          : {
              // modül path’ini kesinleştir
              target: require.resolve('pino-pretty'),
              options: {
                colorize: true,
                levelFirst: true,
                singleLine: false,
                translateTime: 'SYS:yyyy-mm-dd HH:MM:ss.l',
                ignore: 'pid,hostname',
                messageKey: 'msg',
              },
            },
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
