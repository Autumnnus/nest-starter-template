import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { WebsocketService } from 'src/websocket/websocket.service';

interface BroadcastPayload {
  message?: string;
}

@WebSocketGateway({
  namespace: '/ws',
  cors: {
    origin: '*',
  },
})
export class WebsocketGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(WebsocketGateway.name);

  @WebSocketServer()
  private server!: Server;

  constructor(private readonly websocketService: WebsocketService) {}

  async afterInit(server: Server): Promise<void> {
    this.server = server;

    await this.websocketService.registerListener((message) => {
      this.server.emit('broadcast', { message });
    });

    this.logger.log('Websocket gateway initialized');
  }

  handleConnection(client: Socket): void {
    this.logger.debug(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('broadcast')
  async handleBroadcast(
    client: Socket,
    payload: BroadcastPayload,
  ): Promise<void> {
    const message = this.websocketService.sanitizeMessage(payload?.message);

    if (!message) {
      this.logger.warn(`Received empty broadcast message from ${client.id}`);
      return;
    }

    await this.websocketService.publishMessage(message);
  }
}
