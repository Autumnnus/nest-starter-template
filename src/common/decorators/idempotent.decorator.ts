import { SetMetadata } from '@nestjs/common';

export const IDEMPOTENCY_REQUIRED_KEY = 'idempotencyRequired';

export const Idempotent = () => SetMetadata(IDEMPOTENCY_REQUIRED_KEY, true);
