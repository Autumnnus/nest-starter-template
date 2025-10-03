import { registerAs } from '@nestjs/config';

interface TcpMessagingConfig {
  host: string;
  port: number;
}

export default registerAs('messaging', (): { tcp: TcpMessagingConfig } => ({
  tcp: {
    host: process.env.NOTIFICATION_MICROSERVICE_HOST ?? '127.0.0.1',
    port: Number(process.env.NOTIFICATION_MICROSERVICE_PORT ?? 8877),
  },
}));
