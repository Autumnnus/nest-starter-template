import { Logger, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from 'src/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
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

  const port = configService.get<number>('PORT') ?? 3005;
  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`\x1b[34mServer is running on ${port}\x1b[0m`);
  logger.log(
    `\x1b[34mSwagger is running on http://localhost:${port}/api\x1b[0m`,
  );
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
bootstrap();
