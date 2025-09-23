import type { AuthenticatedUser } from 'src/common/interfaces/authenticated-user.interface';

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}
