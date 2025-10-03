import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { NotificationsGateway } from 'src/notifications/gateways/notifications.gateway';
import { NotificationsService } from 'src/notifications/notifications.service';

interface HeartbeatResponse {
  heartbeat: string;
  timestamp: string;
}

@ApiTags('Notifications')
@Controller({ path: 'notifications', version: '1' })
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  @Get('heartbeat')
  @ApiOkResponse({ description: 'Microservice heartbeat response.' })
  async getHeartbeat(): Promise<HeartbeatResponse> {
    const heartbeat = await this.notificationsService.sendHeartbeat();
    const response: HeartbeatResponse = {
      heartbeat,
      timestamp: new Date().toISOString(),
    };

    this.notificationsGateway.emitHeartbeat(heartbeat);

    return response;
  }
}
