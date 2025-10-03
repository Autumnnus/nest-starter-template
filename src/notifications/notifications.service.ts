import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { NOTIFICATIONS_MICROSERVICE } from 'src/notifications/notifications.constants';

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(NOTIFICATIONS_MICROSERVICE)
    private readonly notificationsClient: ClientProxy,
  ) {}

  async sendHeartbeat(): Promise<string> {
    const response = await firstValueFrom(
      this.notificationsClient.send<string>('notifications.heartbeat', {}),
    );

    return response;
  }
}
