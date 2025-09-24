import { Controller, Get, Param, Patch, Query, Body, Req, ForbiddenException } from '@nestjs/common';
import { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Idempotent } from '../common/decorators/idempotent.decorator';
import { RateLimit } from '../common/decorators/rate-limit.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/types/role.enum';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { UsersService } from './users.service';
import { validateListUsersQuery } from './dto/list-users.dto';
import { validateUpdateUserRequest } from './dto/update-user.dto';

@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(Role.Admin, Role.Moderator)
  list(@Query() query: Record<string, unknown>) {
    const filters = validateListUsersQuery(query);
    return this.usersService.listUsers(filters);
  }

  @Get(':id')
  getUser(@Param('id') userId: string, @CurrentUser() currentUser: AuthenticatedUser) {
    const isSelf = currentUser.id === userId;
    const hasPrivilege = currentUser.roles.includes(Role.Admin) || currentUser.roles.includes(Role.Moderator);
    if (!isSelf && !hasPrivilege) {
      throw new ForbiddenException({
        code: 'ACCESS_DENIED',
        message: 'You are not allowed to view this profile.',
      });
    }
    return this.usersService.findById(userId);
  }

  @Patch(':id')
  @Idempotent()
  @RateLimit({ limit: 30, windowMs: 60_000 })
  updateUser(
    @Param('id') userId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() body: unknown,
    @Req() request: Request,
  ) {
    const isSelf = currentUser.id === userId;
    const isAdmin = currentUser.roles.includes(Role.Admin);
    if (!isSelf && !isAdmin) {
      throw new ForbiddenException({
        code: 'NOT_OWNER_OF_PROFILE',
        message: 'You can only update your own profile unless you are an administrator.',
      });
    }
    const updateRequest = validateUpdateUserRequest(body);
    return this.usersService.updateUser(userId, updateRequest, request.traceId);
  }
}
