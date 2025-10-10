import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Idempotent } from 'src/common/decorators/idempotent.decorator';
import { RateLimit } from 'src/common/decorators/rate-limit.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UserScope } from 'src/common/decorators/user-scope.decorator';
import { OptionalFileInterceptor } from 'src/common/interceptors/optional-file.interceptor';
import { ROUTES } from 'src/common/routes';
import { Role } from 'src/common/types/role.enum';
import { ListUsersQueryDto } from 'src/users/dto/list-users.dto';
import { UpdateUserDto } from 'src/users/dto/update-user.dto';
import { UsersService } from 'src/users/users.service';

import type { Request } from 'express';
import type { IUser } from 'src/auth/interfaces/authenticated-user.interface';

@Controller(ROUTES.users.root)
@ApiTags('Users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(Role.Admin, Role.Moderator)
  @ApiOperation({
    summary: 'List users',
    description: 'Returns paginated list of users with optional filters.',
  })
  @ApiOkResponse({
    description: 'Users list',
    schema: {
      example: {
        items: [
          {
            id: 'u_01',
            email: 'john@example.com',
            roles: ['USER'],
            profile: {
              displayName: 'John',
              photo: {
                manifestKey:
                  'media/image/avatar/2024/01/01/abcdef123456-uuid/manifest.json',
              },
            },
          },
        ],
        page: 1,
        limit: 10,
        total: 1,
      },
    },
  })
  async list(@Query() query: ListUsersQueryDto) {
    return this.usersService.listUsers(query);
  }

  @Get(ROUTES.users.byId)
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiParam({ name: 'userId', example: 'u_01', description: 'User ID' })
  @ApiOkResponse({
    description: 'User detail',
    schema: {
      example: {
        id: 'u_01',
        email: 'john@example.com',
        roles: ['USER'],
        profile: {
          displayName: 'John',
          photo: {
            manifestKey:
              'media/image/avatar/2024/01/01/abcdef123456-uuid/manifest.json',
          },
        },
      },
    },
  })
  async getUser(
    @Param('userId') userId: string,
    @CurrentUser() currentUser: IUser,
  ) {
    const isSelf = currentUser.id === userId;
    const hasPrivilege =
      currentUser.roles.includes(Role.Admin) ||
      currentUser.roles.includes(Role.Moderator);
    if (!isSelf && !hasPrivilege) {
      throw new ForbiddenException({
        code: 'ACCESS_DENIED',
        message: 'You are not allowed to view this profile.',
      });
    }

    return this.usersService.findById(userId);
  }

  @Patch(ROUTES.users.byId)
  @Idempotent()
  @RateLimit({ limit: 30, windowSec: 60, strategy: 'fixed' })
  @ApiOperation({ summary: 'Update user profile' })
  @ApiParam({ name: 'userId', example: 'u_01', description: 'User ID' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Unique key for this request (e.g., UUID)',
    example: 'b2f0d9d2-2d6b-4c9b-8a9f-2f4a1c3d5e6f',
  })
  @ApiBearerAuth('JWT-auth')
  @UseInterceptors(OptionalFileInterceptor('photo', { limits: { files: 1 } }))
  @ApiConsumes('application/json', 'multipart/form-data')
  @UserScope({ allowRoles: [Role.Admin], paramKey: 'userId' })
  async updateUser(
    @Param('userId') userId: string,
    @Body() body: UpdateUserDto,
    @UploadedFile() photo: Express.Multer.File | undefined,
    @Req() request: Request,
  ) {
    return this.usersService.updateUser(userId, body, request.traceId, photo);
  }
}
