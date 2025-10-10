import { registerAs } from '@nestjs/config';
import { zBooleanFlag } from 'src/common/utils/zod-helper';
import { z } from 'zod';

const rabbitMqEnvSchema = z.object({
  RABBITMQ_URLS: z
    .string()
    .transform((value) =>
      value
        .split(',')
        .map((url) => url.trim())
        .filter((url) => url.length > 0),
    )
    .refine((value) => value.length > 0)
    .catch(['amqp://localhost:5672']),
  RABBITMQ_QUEUE: z.string().trim().min(1).catch('nest_starter_queue'),
  RABBITMQ_PREFETCH: z.coerce.number().int().positive().catch(1),
  RABBITMQ_QUEUE_DURABLE: zBooleanFlag,
  RABBITMQ_IS_GLOBAL_PREFETCH: zBooleanFlag,
});

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
  const queue = process.env.RABBITMQ_QUEUE?.trim();
  const prefetch = process.env.RABBITMQ_PREFETCH?.trim();

  const env = rabbitMqEnvSchema.parse({
    RABBITMQ_URLS: process.env.RABBITMQ_URLS,
    RABBITMQ_QUEUE: queue && queue.length > 0 ? queue : undefined,
    RABBITMQ_PREFETCH: prefetch && prefetch.length > 0 ? prefetch : undefined,
    RABBITMQ_QUEUE_DURABLE: process.env.RABBITMQ_QUEUE_DURABLE,
    RABBITMQ_IS_GLOBAL_PREFETCH: process.env.RABBITMQ_IS_GLOBAL_PREFETCH,
  });

  return {
    urls: env.RABBITMQ_URLS,
    queue: env.RABBITMQ_QUEUE,
    queueOptions: {
      durable: env.RABBITMQ_QUEUE_DURABLE ?? true,
    },
    prefetchCount: env.RABBITMQ_PREFETCH,
    isGlobalPrefetch: env.RABBITMQ_IS_GLOBAL_PREFETCH ?? false,
  };
});
