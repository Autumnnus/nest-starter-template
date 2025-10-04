import { VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Transport } from '@nestjs/microservices';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AppModule } from 'src/app.module';

import type { MicroserviceOptions } from '@nestjs/microservices';
import type { RabbitMQConfig } from 'src/config/rabbitmq.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });
  app.enableCors();
  const config = new DocumentBuilder()
    .setTitle('Nest Starter')
    .setDescription('Nest Starter API Documentation')
    .setVersion('1.0')
    .addTag('Authentication', 'Authentication endpoints')
    .addTag('Nest Starter')
    .addApiKey(
      {
        type: 'apiKey',
        name: 'Idempotency-Key',
        in: 'header',
        description: 'UUID gibi benzersiz anahtar',
      },
      'Idempotency',
    )
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, documentFactory);

  const configService = app.get(ConfigService);
  const logger = app.get(Logger);

  const rabbitmqConfig = configService.get<RabbitMQConfig>('rabbitmq');

  if (rabbitmqConfig) {
    app.connectMicroservice<MicroserviceOptions>({
      transport: Transport.RMQ,
      options: {
        urls: rabbitmqConfig.urls,
        queue: rabbitmqConfig.queue,
        queueOptions: rabbitmqConfig.queueOptions,
        prefetchCount: rabbitmqConfig.prefetchCount,
        isGlobalPrefetch: rabbitmqConfig.isGlobalPrefetch,
      },
    });

    await app.startAllMicroservices();
    logger.log('\x1b[34mRabbitMQ microservice is running\x1b[0m');
  }

  const port = configService.get<number>('PORT') ?? 3005;
  await app.listen(port);

  logger.log(`\x1b[34mServer is running on ${port}\x1b[0m`);
  logger.log(
    `\x1b[34mSwagger is running on http://localhost:${port}/api\x1b[0m`,
  );
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
bootstrap();
