import { Controller, Logger } from '@nestjs/common';
import { Ctx, MessagePattern, Payload, TcpContext } from '@nestjs/microservices';

@Controller()
export class NotificationsMessageController {
  private readonly logger = new Logger(NotificationsMessageController.name);

  @MessagePattern('notifications.heartbeat')
  handleHeartbeat(
    @Payload() _payload: unknown,
    @Ctx() context: TcpContext,
  ): string {
    const tcpContext = context.getTcpContext();
    const clientAddress = tcpContext.getSocketRef().remoteAddress;
    this.logger.debug(`Heartbeat requested from ${clientAddress ?? 'unknown'}`);

    return 'pong';
  }
}
