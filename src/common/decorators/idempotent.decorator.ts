import { applyDecorators, SetMetadata } from '@nestjs/common';
import { ApiSecurity } from '@nestjs/swagger';

export const IDEMPOTENCY_REQUIRED_KEY = 'idempotencyRequired';

export const Idempotent = () =>
  applyDecorators(
    SetMetadata(IDEMPOTENCY_REQUIRED_KEY, true),
    ApiSecurity('Idempotency'),
  );
