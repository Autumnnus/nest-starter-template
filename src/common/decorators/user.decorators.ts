import { createParamDecorator } from '@nestjs/common';

import type { ExecutionContext } from '@nestjs/common';
import type { AuthenticatedUser } from 'src/auth/interfaces/authenticated-user.interface';

export const User = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest<AuthenticatedUser>();
    return req.user;
  },
);
