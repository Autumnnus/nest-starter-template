import { registerAs } from '@nestjs/config';
import { zBooleanFlag } from 'src/common/utils/zod-helper';
import { z } from 'zod';

const databaseEnvSchema = z.object({
  NODE_ENV: z.string().optional(),
  DB_HOST: z.string().optional().default('localhost'),
  DB_PORT: z.coerce.number().int().positive().catch(5432),
  DB_USER: z.string().optional().default('postgres'),
  DB_PASSWORD: z.string().optional().default('postgres'),
  DB_NAME: z.string().optional().default('nest_app'),
  DB_SYNCHRONIZE: zBooleanFlag,
  DB_LOGGING: zBooleanFlag,
  DB_SSL: zBooleanFlag,
});

export interface DatabaseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  name: string;
  synchronize: boolean;
  logging: boolean;
  ssl: boolean;
}

export default registerAs('database', (): DatabaseConfig => {
  const sanitizedDbPort = process.env.DB_PORT?.trim();

  const env = databaseEnvSchema.parse({
    NODE_ENV: process.env.NODE_ENV,
    DB_HOST: process.env.DB_HOST,
    DB_PORT: sanitizedDbPort ? sanitizedDbPort : undefined,
    DB_USER: process.env.DB_USER,
    DB_PASSWORD: process.env.DB_PASSWORD,
    DB_NAME: process.env.DB_NAME,
    DB_SYNCHRONIZE: process.env.DB_SYNCHRONIZE,
    DB_LOGGING: process.env.DB_LOGGING,
    DB_SSL: process.env.DB_SSL,
  });

  const isProduction = env.NODE_ENV === 'production';

  return {
    host: env.DB_HOST,
    port: env.DB_PORT,
    username: env.DB_USER,
    password: env.DB_PASSWORD,
    name: env.DB_NAME,
    synchronize: env.DB_SYNCHRONIZE ?? !isProduction,
    logging: env.DB_LOGGING ?? !isProduction,
    ssl: env.DB_SSL ?? false,
  };
});
