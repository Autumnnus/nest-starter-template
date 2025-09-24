import { createParamDecorator } from '@nestjs/common';

import type { ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { IUser } from 'src/auth/interfaces/authenticated-user.interface';

export const User = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): IUser | undefined => {
    const req = ctx.switchToHttp().getRequest<Request>();
    return req.user;
  },
);
