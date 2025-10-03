import { Logger } from '@nestjs/common';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

interface HeartbeatPayload {
  heartbeat: string;
  timestamp: string;
}

@WebSocketGateway({ namespace: 'notifications', cors: true })
export class NotificationsGateway {
  @WebSocketServer()
  private readonly server!: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  emitHeartbeat(heartbeat: string): void {
    const payload: HeartbeatPayload = {
      heartbeat,
      timestamp: new Date().toISOString(),
    };

    this.logger.verbose(`Broadcasting heartbeat: ${JSON.stringify(payload)}`);
    this.server.emit('heartbeat', payload);
  }
}
