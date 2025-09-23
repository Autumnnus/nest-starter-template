import { createParamDecorator } from '@nestjs/common';
import { type AuthenticatedUser } from 'src/auth/interfaces/authenticated-user.interface';

import type { ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (_: unknown, context: ExecutionContext): AuthenticatedUser | undefined => {
    const request = context.switchToHttp().getRequest<AuthenticatedUser>();
    return request.user;
  },
);
