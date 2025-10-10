import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  ResolvedUserScopeOptions,
  USER_SCOPE_METADATA_KEY,
} from 'src/common/decorators/user-scope.constants';

import type { Request } from 'express';

@Injectable()
export class UserScopeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const options = this.reflector.getAllAndOverride<ResolvedUserScopeOptions>(
      USER_SCOPE_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!options) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const currentUser = request.user;
    if (!currentUser) {
      throw new ForbiddenException({
        code: 'ACCESS_DENIED',
        message: 'Authenticated user could not be determined from the token.',
      });
    }

    const params = request.params ?? {};
    const providedId = params[options.paramKey];

    if (
      typeof providedId !== 'string' ||
      providedId.length === 0 ||
      providedId === 'me'
    ) {
      params[options.paramKey] = currentUser.id;
      request.params = params;
      return true;
    }

    if (providedId === currentUser.id) {
      return true;
    }

    const hasPrivilegedRole = options.allowRoles.some((role) =>
      currentUser.roles.includes(role),
    );

    if (hasPrivilegedRole) {
      return true;
    }

    throw new ForbiddenException({
      code: 'ACCESS_DENIED',
      message: 'You are not allowed to access this resource.',
    });
  }
}
