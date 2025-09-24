import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from 'src/common/services/audit.service';
import { Role } from 'src/common/types/role.enum';
import {
  paginateArray,
  PaginatedResult,
} from 'src/common/utils/pagination.util';
import { ListUsersQueryDto } from 'src/users/dto/list-users.dto';
import { UpdateUserDto } from 'src/users/dto/update-user.dto';
import {
  PublicUser,
  UserProfile,
  UserRecord,
} from 'src/users/interfaces/user.interface';

@Injectable()
export class UsersService {
  private readonly users: UserRecord[] = [
    {
      id: 'user-learner',
      email: 'learner@example.com',
      password: 'Learner#123',
      roles: [Role.User],
      profile: {
        displayName: 'Learner One',
        locale: 'en-US',
        bio: 'Focused on mastering backend development.',
      },
      createdAt: '2024-01-10T09:00:00.000Z',
      updatedAt: '2024-01-10T09:00:00.000Z',
    },
    {
      id: 'user-instructor',
      email: 'instructor@example.com',
      password: 'Instructor#123',
      roles: [Role.Moderator],
      profile: {
        displayName: 'Instructor Jane',
        locale: 'en-US',
        bio: 'Teaches advanced NestJS workshops.',
      },
      createdAt: '2024-01-05T08:30:00.000Z',
      updatedAt: '2024-01-05T08:30:00.000Z',
    },
    {
      id: 'user-admin',
      email: 'admin@example.com',
      password: 'Admin#123',
      roles: [Role.Admin],
      profile: {
        displayName: 'Platform Admin',
        locale: 'en-US',
        bio: 'Ensures operations run smoothly.',
      },
      createdAt: '2023-12-30T12:00:00.000Z',
      updatedAt: '2023-12-30T12:00:00.000Z',
    },
  ];

  constructor(private readonly auditService: AuditService) {}

  listUsers(query: ListUsersQueryDto): PaginatedResult<PublicUser> {
    const filtered = this.users.filter((user) => {
      if (query.role && !user.roles.includes(query.role)) {
        return false;
      }

      if (query.search) {
        const normalized = query.search.toLowerCase();
        return (
          user.email.toLowerCase().includes(normalized) ||
          user.profile.displayName.toLowerCase().includes(normalized)
        );
      }

      return true;
    });

    const sorted = [...filtered].sort((a, b) => a.email.localeCompare(b.email));
    const paginated = paginateArray(sorted, {
      page: query.page,
      limit: query.limit,
    });

    return {
      data: paginated.data.map((user) => this.toPublicUser(user)),
      pagination: paginated.pagination,
    };
  }

  findById(userId: string): PublicUser {
    const record = this.findUserRecordById(userId);
    if (!record) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'User could not be found.',
      });
    }

    return this.toPublicUser(record);
  }

  updateUser(
    userId: string,
    request: UpdateUserDto,
    traceId: string | undefined,
  ): PublicUser {
    const record = this.findUserRecordById(userId);
    if (!record) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'User could not be found.',
      });
    }

    const updatedProfile: UserProfile = {
      ...record.profile,
      ...request.profile,
    };

    const now = new Date().toISOString();
    record.profile = updatedProfile;
    record.updatedAt = now;

    this.auditService.record('user.profile.updated', {
      userId,
      traceId,
      metadata: {
        updatedFields: Object.keys(request.profile),
      },
    });

    return this.toPublicUser(record);
  }

  validateCredentials(email: string, password: string): UserRecord | undefined {
    const normalizedEmail = email.toLowerCase();
    return this.users.find(
      (user) =>
        user.email.toLowerCase() === normalizedEmail &&
        user.password === password,
    );
  }

  findUserRecordById(userId: string): UserRecord | undefined {
    return this.users.find((user) => user.id === userId);
  }

  private toPublicUser(user: UserRecord): PublicUser {
    return {
      id: user.id,
      email: user.email,
      roles: [...user.roles],
      profile: { ...user.profile },
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
