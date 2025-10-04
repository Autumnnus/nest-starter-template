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
import { PresenceService } from 'src/presence/presence.service';
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
  private static readonly PRESENCE_TTL_SEC = 30;
  private static readonly HEARTBEAT_INTERVAL_MS = Math.max(
    1000,
    Math.floor((WebsocketGateway.PRESENCE_TTL_SEC * 1000) / 2),
  );

  private readonly presenceHeartbeats = new Map<
    string,
    { userId: string; timer: NodeJS.Timeout }
  >();

  @WebSocketServer()
  private server!: Server;

  constructor(
    private readonly websocketService: WebsocketService,
    private readonly presenceService: PresenceService,
  ) {}

  async afterInit(server: Server): Promise<void> {
    this.server = server;

    await this.websocketService.registerListener((message) => {
      this.server.emit('broadcast', { message });
    });

    this.logger.log('Websocket gateway initialized');
  }

  handleConnection(client: Socket): void {
    this.logger.debug(`Client connected: ${client.id}`);
    void this.initializePresenceHeartbeat(client);
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`Client disconnected: ${client.id}`);
    this.stopPresenceHeartbeat(client.id);
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

  private async initializePresenceHeartbeat(client: Socket): Promise<void> {
    const userId = this.extractUserId(client);

    if (!userId) {
      this.logger.warn(
        `Skipping presence heartbeat for client ${client.id}: missing userId`,
      );
      return;
    }

    this.stopPresenceHeartbeat(client.id);

    try {
      await this.presenceService.presencePing(
        userId,
        WebsocketGateway.PRESENCE_TTL_SEC,
      );
    } catch (error) {
      this.logger.error(
        `Failed to initialize presence heartbeat for user ${userId}`,
        error as Error,
      );
      return;
    }

    const timer = setInterval(() => {
      this.presenceService
        .presencePing(userId, WebsocketGateway.PRESENCE_TTL_SEC)
        .catch((error) => {
          this.logger.error(
            `Failed to refresh presence heartbeat for user ${userId}`,
            error as Error,
          );
        });
    }, WebsocketGateway.HEARTBEAT_INTERVAL_MS);

    this.presenceHeartbeats.set(client.id, { userId, timer });
  }

  private stopPresenceHeartbeat(clientId: string): void {
    const heartbeat = this.presenceHeartbeats.get(clientId);

    if (!heartbeat) {
      return;
    }

    clearInterval(heartbeat.timer);
    this.presenceHeartbeats.delete(clientId);
  }

  private extractUserId(client: Socket): string | null {
    const candidate =
      client.handshake.auth?.userId ?? client.handshake.query?.userId;

    if (Array.isArray(candidate)) {
      return this.normalizeUserId(candidate[0]);
    }

    if (candidate === undefined || candidate === null) {
      return null;
    }

    return this.normalizeUserId(candidate);
  }

  private normalizeUserId(value: unknown): string | null {
    if (value === undefined || value === null) {
      return null;
    }

    const normalized = String(value).trim();
    return normalized.length > 0 ? normalized : null;
  }
}
