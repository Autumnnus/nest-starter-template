import { registerAs } from '@nestjs/config';

const toNumber = (value: string | undefined, fallback: number): number => {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

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
  const isProduction = process.env.NODE_ENV === 'production';
  const shouldSynchronize = process.env.DB_SYNCHRONIZE
    ? process.env.DB_SYNCHRONIZE === 'true'
    : !isProduction;
  const shouldLog = process.env.DB_LOGGING
    ? process.env.DB_LOGGING === 'true'
    : !isProduction;

  return {
    host: process.env.DB_HOST ?? 'localhost',
    port: toNumber(process.env.DB_PORT, 5432),
    username: process.env.DB_USER ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
    name: process.env.DB_NAME ?? 'nest_app',
    synchronize: shouldSynchronize,
    logging: shouldLog,
    ssl: process.env.DB_SSL === 'true',
  };
});
