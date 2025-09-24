import { createParamDecorator } from '@nestjs/common';

import type { ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { IUser } from 'src/auth/interfaces/authenticated-user.interface';

export const CurrentUser = createParamDecorator(
  (_: unknown, context: ExecutionContext): IUser | undefined => {
    const request = context.switchToHttp().getRequest<Request>();
    return request.user;
  },
);
