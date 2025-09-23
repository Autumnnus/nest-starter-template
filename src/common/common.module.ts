import { Global, Module } from '@nestjs/common';
import { AuditService } from 'src/common/services/audit.service';
import { IdempotencyService } from 'src/common/services/idempotency.service';
import { RateLimitService } from 'src/common/services/rate-limit.service';

@Global()
@Module({
  providers: [AuditService, IdempotencyService, RateLimitService],
  exports: [AuditService, IdempotencyService, RateLimitService],
})
export class CommonModule {}
