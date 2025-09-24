import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth(traceId?: string) {
    return {
      status: 'ok',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      traceId,
    };
  }
}
