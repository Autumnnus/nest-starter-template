import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NotificationsGateway } from 'src/notifications/gateways/notifications.gateway';
import { NotificationsController } from 'src/notifications/notifications.controller';
import { NotificationsMessageController } from 'src/notifications/notifications-message.controller';
import { NotificationsService } from 'src/notifications/notifications.service';
import { NOTIFICATIONS_MICROSERVICE } from 'src/notifications/notifications.constants';

@Module({
  imports: [
    ConfigModule,
    ClientsModule.registerAsync([
      {
        name: NOTIFICATIONS_MICROSERVICE,
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => {
          const host = configService.get<string>('messaging.tcp.host', '127.0.0.1');
          const port = configService.get<number>('messaging.tcp.port', 8877);

          return {
            transport: Transport.TCP,
            options: {
              host,
              port,
            },
          };
        },
      },
    ]),
  ],
  controllers: [NotificationsController, NotificationsMessageController],
  providers: [NotificationsService, NotificationsGateway],
  exports: [NotificationsService],
})
export class NotificationsModule {}
