export interface HttpLogContext {
  method?: string;
  path?: string;
  statusCode?: number;
  ipAddress?: string;
  userAgent?: string;
  responseTimeMs?: number;
  requestBody?: unknown;
  query?: Record<string, unknown> | undefined;
  params?: Record<string, unknown> | undefined;
}

export interface AuditLogMessage {
  event: string;
  userId?: string;
  traceId?: string;
  metadata?: Record<string, unknown>;
  context?: HttpLogContext;
  occurredAt: string;
}

export interface ApplicationLogMessage {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  timestamp: string;
  traceId?: string;
  userId?: string;
  context: HttpLogContext & {
    event?: string;
  };
}
