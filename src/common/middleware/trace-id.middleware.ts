import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';

import type { NextFunction, Request, Response } from 'express';

@Injectable()
export class TraceIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const traceId = req.headers['x-trace-id'];
    const resolvedTraceId =
      typeof traceId === 'string' && traceId.trim() ? traceId : randomUUID();
    req.traceId = resolvedTraceId;
    res.setHeader('X-Trace-Id', resolvedTraceId);
    next();
  }
}
