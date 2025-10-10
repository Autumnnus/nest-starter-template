import { Global, Module } from '@nestjs/common';
import { UserScopeGuard } from 'src/common/guards/user-scope.guard';
import { AuditService } from 'src/common/services/audit.service';
import { IdempotencyService } from 'src/common/services/idempotency.service';
import { RateLimitService } from 'src/common/services/rate-limit.service';
import { RedisModule } from 'src/redis/redis.module';

@Global()
@Module({
  imports: [RedisModule],
  providers: [
    AuditService,
    IdempotencyService,
    RateLimitService,
    UserScopeGuard,
  ],
  exports: [AuditService, IdempotencyService, RateLimitService, UserScopeGuard],
})
export class CommonModule {}
