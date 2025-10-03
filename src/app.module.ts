import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { AppController } from 'src/app.controller';
import { AppService } from 'src/app.service';
import { AuthModule } from 'src/auth/auth.module';
import { CommonModule } from 'src/common/common.module';
import { GlobalExceptionFilter } from 'src/common/filters/global-exception.filter';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { RateLimitGuard } from 'src/common/guards/rate-limit.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { IdempotencyInterceptor } from 'src/common/interceptors/idempotency.interceptor';
import { TraceIdMiddleware } from 'src/common/middleware/trace-id.middleware';
import { AppValidationPipe } from 'src/common/pipes/app-validation.pipe';
import databaseConfig from 'src/config/database.config';
import rabbitmqConfig from 'src/config/rabbitmq.config';
import redisConfig from 'src/config/redis.config';
import { DatabaseModule } from 'src/database/database.module';
import { RabbitMQModule } from 'src/rabbitmq/rabbitmq.module';
import { RedisModule } from 'src/redis/redis.module';
import { UsersModule } from 'src/users/users.module';
import { WebsocketModule } from 'src/websocket/websocket.module';

@Module({
  imports: [
    CommonModule,
    AuthModule,
    UsersModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [databaseConfig, redisConfig, rabbitmqConfig],
    }),
    DatabaseModule,
    RedisModule,
    RabbitMQModule,
    WebsocketModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
    { provide: APP_PIPE, useClass: AppValidationPipe },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TraceIdMiddleware).forRoutes('*');
  }
}
