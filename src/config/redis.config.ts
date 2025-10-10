import { registerAs } from '@nestjs/config';
import { zBooleanFlag } from 'src/common/utils/zod-helper';
import { z } from 'zod';

const redisEnvSchema = z.object({
  REDIS_HOST: z.string().optional().default('127.0.0.1'),
  REDIS_PORT: z.coerce.number().int().positive().catch(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.coerce.number().int().nonnegative().catch(0),
  REDIS_KEY_PREFIX: z.string().optional(),
  REDIS_TLS: zBooleanFlag,
});

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  keyPrefix?: string;
  useTls: boolean;
}

export default registerAs('redis', (): RedisConfig => {
  const port = process.env.REDIS_PORT?.trim();
  const db = process.env.REDIS_DB?.trim();

  const env = redisEnvSchema.parse({
    REDIS_HOST: process.env.REDIS_HOST,
    REDIS_PORT: port && port.length > 0 ? port : undefined,
    REDIS_PASSWORD: process.env.REDIS_PASSWORD,
    REDIS_DB: db && db.length > 0 ? db : undefined,
    REDIS_KEY_PREFIX: process.env.REDIS_KEY_PREFIX,
    REDIS_TLS: process.env.REDIS_TLS,
  });

  return {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD,
    db: env.REDIS_DB,
    keyPrefix: env.REDIS_KEY_PREFIX,
    useTls: env.REDIS_TLS ?? false,
  };
});
