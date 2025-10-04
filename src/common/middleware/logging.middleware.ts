import { Injectable, NestMiddleware } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { LoggingQueueService } from 'src/logging/logging-queue.service';
import { DEFAULT_APPLICATION_LOG_LEVEL } from 'src/logging/logging.constants';

import type { NextFunction, Request, Response } from 'express';

const SENSITIVE_KEYS = [
  'password',
  'refreshToken',
  'accessToken',
  'token',
  'secret',
];

@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  constructor(
    private readonly loggingQueueService: LoggingQueueService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(LoggingMiddleware.name);
  }

  use(req: Request, res: Response, next: NextFunction): void {
    const start = process.hrtime.bigint();
    const { method } = req;
    const path = req.originalUrl || req.url;

    res.on('finish', () => {
      const durationNs = process.hrtime.bigint() - start;
      const responseTimeMs = Number(durationNs) / 1_000_000;
      const statusCode = res.statusCode;
      const traceId = req.traceId;
      const userId =
        typeof req.user?.id === 'string' ? req.user?.id : undefined;
      const ipAddress = req.ip;
      const userAgent = req.headers['user-agent'];
      const timestamp = new Date().toISOString();

      const sanitizedBody = this.sanitizePayload(req.body);

      const context = {
        method,
        path,
        statusCode,
        ipAddress,
        userAgent,
        responseTimeMs: Number.isNaN(responseTimeMs)
          ? undefined
          : Math.round(responseTimeMs),
        requestBody: sanitizedBody,
        query: this.toRecord(req.query),
        params: this.toRecord(req.params),
      };

      this.logger.info({
        event: 'http_request_completed',
        method,
        path,
        statusCode,
        traceId,
        responseTimeMs: context.responseTimeMs,
      });

      void this.loggingQueueService.enqueueApplicationLog({
        level: DEFAULT_APPLICATION_LOG_LEVEL,
        message: 'HTTP request completed',
        timestamp,
        traceId,
        userId,
        context,
      });

      void this.loggingQueueService.enqueueAuditLog({
        event: 'http.request',
        occurredAt: timestamp,
        traceId,
        userId,
        context,
      });
    });

    next();
  }

  private sanitizePayload(payload: unknown): unknown {
    if (!payload || typeof payload !== 'object') {
      return payload;
    }

    if (Array.isArray(payload)) {
      return payload.map((item) => this.sanitizePayload(item));
    }

    const clone: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(payload)) {
      if (SENSITIVE_KEYS.includes(key)) {
        clone[key] = '[REDACTED]';
      } else if (value && typeof value === 'object') {
        clone[key] = this.sanitizePayload(value);
      } else {
        clone[key] = value;
      }
    }
    return clone;
  }

  private toRecord(value: unknown): Record<string, unknown> | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return undefined;
    }

    return { ...value } as Record<string, unknown>;
  }
}
