import type { Request, Response } from 'express';
import type { Role } from 'src/common/types/role.enum';

export interface AuthenticatedUser extends Request {
  id: string;
  email: string;
  roles: Role[];
  sessionId: string;
}

export interface ApiError extends Response {
  error: { code: string; message: string; traceId: string; details?: unknown };
}
