import type { IUser } from 'src/auth/interfaces/authenticated-user.interface';

declare module 'express-serve-static-core' {
  interface Request {
    user?: IUser;
    accessToken?: string;
    refreshToken?: string;
    sessionId?: string;
    traceId?: string;
  }

  interface Response {
    error: {
      code: string;
      message: string;
      traceId: string;
      details?: unknown;
    };
  }
}
