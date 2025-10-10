import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
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

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiParam({ name: 'id', example: 'u_01', description: 'User ID' })
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
    @Param('id') userId: string,
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

  @Patch(':id')
  @Idempotent()
  @RateLimit({ limit: 30, windowSec: 60, strategy: 'fixed' })
  @ApiOperation({ summary: 'Update user profile' })
  @ApiParam({ name: 'id', example: 'u_01', description: 'User ID' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Unique key for this request (e.g., UUID)',
    example: 'b2f0d9d2-2d6b-4c9b-8a9f-2f4a1c3d5e6f',
  })
  @ApiBearerAuth('JWT-auth')
  @ApiOkResponse({
    description: 'Updated user',
    schema: {
      example: {
        id: 'u_01',
        email: 'john@example.com',
        roles: ['USER'],
        profile: {
          displayName: 'John Doe',
          locale: 'en-US',
          photo: {
            manifestKey:
              'media/image/avatar/2024/01/01/abcdef123456-uuid/manifest.json',
          },
        },
      },
    },
  })
  async updateUser(
    @Param('id') userId: string,
    @CurrentUser() currentUser: IUser,
    @Body() body: UpdateUserDto,
    @Req() request: Request,
  ) {
    this.ensureCanModifyProfile(userId, currentUser);

    return this.usersService.updateUser(userId, body, request.traceId);
  }

  @Post(':id/profile-photo')
  @UseInterceptors(FileInterceptor('file', { limits: { files: 1 } }))
  @RateLimit({ limit: 15, windowSec: 60, strategy: 'fixed' })
  @ApiOperation({ summary: 'Upload or replace profile photo' })
  @ApiParam({ name: 'id', example: 'u_01', description: 'User ID' })
  @ApiBearerAuth('JWT-auth')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Profile photo upload (JPEG, PNG, WebP, AVIF, HEIC)',
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Image file to use as profile photo',
        },
      },
      required: ['file'],
    },
  })
  @ApiOkResponse({
    description: 'Updated user with profile photo manifest',
    schema: {
      example: {
        id: 'u_01',
        email: 'john@example.com',
        roles: ['USER'],
        profile: {
          displayName: 'John Doe',
          locale: 'en-US',
          photo: {
            manifestKey:
              'media/image/avatar/2024/01/01/abcdef123456-uuid/manifest.json',
            original: {
              key: 'media/image/avatar/2024/01/01/abcdef123456-uuid/original.jpg',
            },
          },
        },
      },
    },
  })
  async uploadProfilePhoto(
    @Param('id') userId: string,
    @CurrentUser() currentUser: IUser,
    @UploadedFile() file: Express.Multer.File,
    @Req() request: Request,
  ) {
    this.ensureCanModifyProfile(userId, currentUser);

    if (!file) {
      throw new BadRequestException({
        code: 'MEDIA_FILE_REQUIRED',
        message: 'A profile photo file must be provided.',
      });
    }

    return this.usersService.updateProfilePhoto(userId, file, request.traceId);
  }

  @Delete(':id/profile-photo')
  @RateLimit({ limit: 15, windowSec: 60, strategy: 'fixed' })
  @ApiOperation({ summary: 'Delete profile photo' })
  @ApiParam({ name: 'id', example: 'u_01', description: 'User ID' })
  @ApiBearerAuth('JWT-auth')
  @ApiOkResponse({
    description: 'Updated user without profile photo',
    schema: {
      example: {
        id: 'u_01',
        email: 'john@example.com',
        roles: ['USER'],
        profile: {
          displayName: 'John Doe',
          locale: 'en-US',
          photo: null,
        },
      },
    },
  })
  async deleteProfilePhoto(
    @Param('id') userId: string,
    @CurrentUser() currentUser: IUser,
    @Req() request: Request,
  ) {
    this.ensureCanModifyProfile(userId, currentUser);

    return this.usersService.removeProfilePhoto(userId, request.traceId);
  }

  private ensureCanModifyProfile(userId: string, currentUser: IUser): void {
    const isSelf = currentUser.id === userId;
    const isAdmin = currentUser.roles.includes(Role.Admin);
    if (!isSelf && !isAdmin) {
      throw new ForbiddenException({
        code: 'NOT_OWNER_OF_PROFILE',
        message:
          'You can only update your own profile unless you are an administrator.',
      });
    }
  }
}
