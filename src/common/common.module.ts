import { Global, Module } from '@nestjs/common';
import { AuditService } from './services/audit.service';
import { IdempotencyService } from './services/idempotency.service';
import { RateLimitService } from './services/rate-limit.service';

@Global()
@Module({
  providers: [AuditService, IdempotencyService, RateLimitService],
  exports: [AuditService, IdempotencyService, RateLimitService],
})
export class CommonModule {}
