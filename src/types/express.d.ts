import type { AuthenticatedUser } from 'src/auth/interfaces/authenticated-user.interface';

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthenticatedUser;
    traceId?: string;
  }
}
