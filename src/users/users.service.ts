import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import * as argon2 from 'argon2';
import { AuditService } from 'src/common/services/audit.service';
import { Role } from 'src/common/types/role.enum';
import { PaginatedResult } from 'src/common/utils/pagination.util';
import { ListUsersQueryDto } from 'src/users/dto/list-users.dto';
import { UpdateUserDto } from 'src/users/dto/update-user.dto';
import { PublicUser, UserProfile, UserRecord } from 'src/users/interfaces/user.interface';
import { UsersRepository } from 'src/users/infrastructure/repositories/users.repository';
import { UserEntity } from 'src/users/infrastructure/entities/user.entity';

interface SeedUserInput {
  email: string;
  password: string;
  roles: Role[];
  displayName: string;
  locale: string;
  bio?: string;
}

@Injectable()
export class UsersService implements OnModuleInit {
  constructor(
    private readonly auditService: AuditService,
    private readonly usersRepository: UsersRepository,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seedDefaultUsers();
  }

  async listUsers(query: ListUsersQueryDto): Promise<PaginatedResult<PublicUser>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const { items, total } = await this.usersRepository.paginate(query);

    return {
      data: items.map((user) => this.toPublicUser(user)),
      pagination: {
        page,
        limit,
        total,
      },
    };
  }

  async findById(userId: string): Promise<PublicUser> {
    const record = await this.usersRepository.findById(userId);
    if (!record) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'User could not be found.',
      });
    }

    return this.toPublicUser(record);
  }

  async updateUser(
    userId: string,
    request: UpdateUserDto,
    traceId: string | undefined,
  ): Promise<PublicUser> {
    const record = await this.usersRepository.updateProfile(
      userId,
      request.profile,
    );
    if (!record) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'User could not be found.',
      });
    }

    this.auditService.record('user.profile.updated', {
      userId,
      traceId,
      metadata: {
        updatedFields: Object.keys(request.profile ?? {}),
      },
    });

    return this.toPublicUser(record);
  }

  async validateCredentials(
    email: string,
    password: string,
  ): Promise<UserRecord | null> {
    const normalizedEmail = email.toLowerCase();
    const entity = await this.usersRepository.findByEmail(normalizedEmail);
    if (!entity) {
      return null;
    }

    const passwordMatches = await argon2.verify(entity.passwordHash, password);
    if (!passwordMatches) {
      return null;
    }

    return this.toUserRecord(entity);
  }

  async findUserRecordById(userId: string): Promise<UserRecord | null> {
    const entity = await this.usersRepository.findById(userId);
    return entity ? this.toUserRecord(entity) : null;
  }

  private toPublicUser(user: UserEntity): PublicUser {
    return {
      id: user.id,
      email: user.email,
      roles: [...user.roles],
      profile: this.toProfile(user),
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  private toUserRecord(user: UserEntity): UserRecord {
    return this.toPublicUser(user);
  }

  private toProfile(user: UserEntity): UserProfile {
    return {
      displayName: user.displayName,
      locale: user.locale,
      bio: user.bio ?? undefined,
    };
  }

  private async seedDefaultUsers(): Promise<void> {
    const shouldSeed = (process.env.DB_SEED ?? 'true') === 'true';
    if (!shouldSeed) {
      return;
    }

    const existing = await this.usersRepository.count();
    if (existing > 0) {
      return;
    }

    const defaults: SeedUserInput[] = [
      {
        email: 'learner@example.com',
        password: 'Learner#123',
        roles: [Role.User],
        displayName: 'Learner One',
        locale: 'en-US',
        bio: 'Focused on mastering backend development.',
      },
      {
        email: 'instructor@example.com',
        password: 'Instructor#123',
        roles: [Role.Moderator],
        displayName: 'Instructor Jane',
        locale: 'en-US',
        bio: 'Teaches advanced NestJS workshops.',
      },
      {
        email: 'admin@example.com',
        password: 'Admin#123',
        roles: [Role.Admin],
        displayName: 'Platform Admin',
        locale: 'en-US',
        bio: 'Ensures operations run smoothly.',
      },
    ];

    for (const user of defaults) {
      const entity = this.usersRepository.create({
        email: user.email.toLowerCase(),
        passwordHash: await argon2.hash(user.password),
        roles: user.roles,
        displayName: user.displayName,
        locale: user.locale,
        bio: user.bio ?? null,
      });

      await this.usersRepository.save(entity);
    }
  }
}
