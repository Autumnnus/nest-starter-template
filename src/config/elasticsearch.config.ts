import { registerAs } from '@nestjs/config';

export interface ElasticsearchConfig {
  node: string;
  username?: string;
  password?: string;
  applicationLogIndex: string;
  requestTimeoutMs: number;
}

export default registerAs('elasticsearch', (): ElasticsearchConfig => {
  const node = process.env.ELASTICSEARCH_NODE ?? 'http://localhost:9200';
  const username = process.env.ELASTICSEARCH_USERNAME;
  const password = process.env.ELASTICSEARCH_PASSWORD;
  const applicationLogIndex =
    process.env.ELASTICSEARCH_APP_LOG_INDEX ?? 'application_logs';
  const timeout = Number.parseInt(
    process.env.ELASTICSEARCH_REQUEST_TIMEOUT_MS ?? '2000',
    10,
  );

  return {
    node,
    username,
    password,
    applicationLogIndex,
    requestTimeoutMs: Number.isNaN(timeout) ? 2000 : timeout,
  };
});
