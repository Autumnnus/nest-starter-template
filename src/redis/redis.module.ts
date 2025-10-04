import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheService } from 'src/redis/cache.service';
import { RedisService } from 'src/redis/redis.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [RedisService, CacheService],
  exports: [RedisService, CacheService],
})
export class RedisModule {}
