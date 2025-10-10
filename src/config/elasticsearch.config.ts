import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const elasticsearchEnvSchema = z.object({
  ELASTICSEARCH_NODE: z.string().trim().url().catch('http://localhost:9200'),
  ELASTICSEARCH_USERNAME: z.string().trim().min(1).optional(),
  ELASTICSEARCH_PASSWORD: z.string().trim().min(1).optional(),
  ELASTICSEARCH_APP_LOG_INDEX: z
    .string()
    .trim()
    .min(1)
    .catch('application_logs'),
  ELASTICSEARCH_REQUEST_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .positive()
    .catch(2000),
});

export interface ElasticsearchConfig {
  node: string;
  username?: string;
  password?: string;
  applicationLogIndex: string;
  requestTimeoutMs: number;
}

export default registerAs('elasticsearch', (): ElasticsearchConfig => {
  const node = process.env.ELASTICSEARCH_NODE?.trim();
  const username = process.env.ELASTICSEARCH_USERNAME?.trim();
  const password = process.env.ELASTICSEARCH_PASSWORD?.trim();
  const applicationLogIndex = process.env.ELASTICSEARCH_APP_LOG_INDEX?.trim();
  const requestTimeout = process.env.ELASTICSEARCH_REQUEST_TIMEOUT_MS?.trim();

  const env = elasticsearchEnvSchema.parse({
    ELASTICSEARCH_NODE: node && node.length > 0 ? node : undefined,
    ELASTICSEARCH_USERNAME:
      username && username.length > 0 ? username : undefined,
    ELASTICSEARCH_PASSWORD:
      password && password.length > 0 ? password : undefined,
    ELASTICSEARCH_APP_LOG_INDEX:
      applicationLogIndex && applicationLogIndex.length > 0
        ? applicationLogIndex
        : undefined,
    ELASTICSEARCH_REQUEST_TIMEOUT_MS:
      requestTimeout && requestTimeout.length > 0 ? requestTimeout : undefined,
  });

  return {
    node: env.ELASTICSEARCH_NODE,
    username: env.ELASTICSEARCH_USERNAME,
    password: env.ELASTICSEARCH_PASSWORD,
    applicationLogIndex: env.ELASTICSEARCH_APP_LOG_INDEX,
    requestTimeoutMs: env.ELASTICSEARCH_REQUEST_TIMEOUT_MS,
  };
});
