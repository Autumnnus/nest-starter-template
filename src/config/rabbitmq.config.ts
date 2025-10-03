import { registerAs } from '@nestjs/config';

export interface RabbitMQConfig {
  urls: string[];
  queue: string;
  queueOptions: {
    durable: boolean;
  };
  prefetchCount: number;
  isGlobalPrefetch: boolean;
}

export default registerAs('rabbitmq', (): RabbitMQConfig => {
  const urls = process.env.RABBITMQ_URLS
    ? process.env.RABBITMQ_URLS.split(',')
        .map((url) => url.trim())
        .filter(Boolean)
    : ['amqp://localhost:5672'];

  const queue = process.env.RABBITMQ_QUEUE ?? 'nest_starter_queue';

  const prefetchCount = Number.parseInt(
    process.env.RABBITMQ_PREFETCH ?? '1',
    10,
  );

  return {
    urls,
    queue,
    queueOptions: {
      durable:
        (process.env.RABBITMQ_QUEUE_DURABLE ?? 'true').toLowerCase() !==
        'false',
    },
    prefetchCount: Number.isNaN(prefetchCount) ? 1 : prefetchCount,
    isGlobalPrefetch:
      (process.env.RABBITMQ_IS_GLOBAL_PREFETCH ?? 'false').toLowerCase() ===
      'true',
  };
});
