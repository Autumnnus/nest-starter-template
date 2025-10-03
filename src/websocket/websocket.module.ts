import { Module } from '@nestjs/common';
import { RedisModule } from 'src/redis/redis.module';
import { WebsocketGateway } from 'src/websocket/websocket.gateway';
import { WebsocketService } from 'src/websocket/websocket.service';

@Module({
  imports: [RedisModule],
  providers: [WebsocketGateway, WebsocketService],
})
export class WebsocketModule {}
