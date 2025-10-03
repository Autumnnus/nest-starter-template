import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { RedisService } from 'src/redis/redis.service';

type MessageHandler = (message: string) => void;

@Injectable()
export class WebsocketService implements OnModuleDestroy {
  private readonly logger = new Logger(WebsocketService.name);
  private publisher: Redis | null = null;
  private subscriber: Redis | null = null;
  private readonly channel = 'ws:broadcast';
  private subscribed = false;

  constructor(private readonly redisService: RedisService) {}

  sanitizeMessage(raw: unknown): string | null {
    if (typeof raw !== 'string') {
      return null;
    }

    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  async publishMessage(message: string): Promise<void> {
    const publisher = this.getPublisher();
    await publisher.publish(this.channel, message);
  }

  async registerListener(handler: MessageHandler): Promise<void> {
    if (this.subscribed) {
      return;
    }

    const subscriber = this.getSubscriber();
    subscriber.on('message', (channel, message) => {
      if (channel === this.channel) {
        handler(message);
      }
    });

    await subscriber.subscribe(this.channel);
    this.subscribed = true;
    this.logger.log(`Subscribed to Redis channel: ${this.channel}`);
  }

  async onModuleDestroy(): Promise<void> {
    const tasks: Array<Promise<unknown>> = [];
    if (this.publisher) {
      tasks.push(this.publisher.quit());
    }

    if (this.subscriber) {
      tasks.push(this.subscriber.quit());
    }

    await Promise.allSettled(tasks);
  }

  private getPublisher(): Redis {
    if (!this.publisher) {
      this.publisher = this.redisService.getClient().duplicate();
    }

    return this.publisher;
  }

  private getSubscriber(): Redis {
    if (!this.subscriber) {
      this.subscriber = this.redisService.getClient().duplicate();
    }

    return this.subscriber;
  }
}
