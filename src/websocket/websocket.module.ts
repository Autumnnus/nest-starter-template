import { Module } from '@nestjs/common';
import { PresenceModule } from 'src/presence/presence.module';
import { RedisModule } from 'src/redis/redis.module';
import { WebsocketGateway } from 'src/websocket/websocket.gateway';
import { WebsocketService } from 'src/websocket/websocket.service';

@Module({
  imports: [RedisModule, PresenceModule],
  providers: [WebsocketGateway, WebsocketService],
})
export class WebsocketModule {}
