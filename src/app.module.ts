import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
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
import { CoursesModule } from 'src/courses/courses.module';
import { SubmissionsModule } from 'src/submissions/submissions.module';
import { UsersModule } from 'src/users/users.module';

@Module({
  imports: [
    CommonModule,
    AuthModule,
    UsersModule,
    CoursesModule,
    SubmissionsModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TraceIdMiddleware).forRoutes('*');
  }
}
