import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { AuditService } from 'src/common/services/audit.service';
import { Role } from 'src/common/types/role.enum';
import { PaginatedResult } from 'src/common/utils/pagination.util';
import { MediaService } from 'src/media/media.service';
import { CacheService } from 'src/redis/cache.service';
import { ListUsersQueryDto } from 'src/users/dto/list-users.dto';
import { UpdateUserDto } from 'src/users/dto/update-user.dto';
import { UserEntity } from 'src/users/infrastructure/entities/user.entity';
import { UsersRepository } from 'src/users/infrastructure/repositories/users.repository';
import {
  PublicUser,
  UserProfile,
  UserRecord,
} from 'src/users/interfaces/user.interface';

import type { MediaManifest } from 'src/media/interfaces/media-manifest.interface';

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
  private static readonly USER_CACHE_ENTITY = 'user';
  private static readonly USER_CACHE_TTL_SECONDS = 30 * 60;
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly auditService: AuditService,
    private readonly usersRepository: UsersRepository,
    private readonly cacheService: CacheService,
    private readonly mediaService: MediaService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seedDefaultUsers();
  }

  async listUsers(
    query: ListUsersQueryDto,
  ): Promise<PaginatedResult<PublicUser>> {
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
    const user = await this.getCachedPublicUser(userId);
    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'User could not be found.',
      });
    }

    return user;
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

    const publicUser = this.toPublicUser(record);
    await this.cacheService.set(
      { entity: UsersService.USER_CACHE_ENTITY, id: userId },
      publicUser,
      { ttlSeconds: UsersService.USER_CACHE_TTL_SECONDS },
    );

    this.auditService.record('user.profile.updated', {
      userId,
      traceId,
      metadata: {
        updatedFields: Object.keys(request.profile ?? {}),
      },
    });

    return publicUser;
  }

  async updateProfilePhoto(
    userId: string,
    file: Express.Multer.File,
    traceId: string | undefined,
  ): Promise<PublicUser> {
    const existing = await this.usersRepository.findById(userId);
    if (!existing) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'User could not be found.',
      });
    }

    const [manifest] = await this.mediaService.uploadMedia([file], {
      purpose: 'avatar',
    });

    await this.safeDeleteMedia(existing.profilePhoto);

    const updated = await this.usersRepository.updateProfilePhoto(
      userId,
      manifest,
    );
    if (!updated) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'User could not be found.',
      });
    }

    const publicUser = this.toPublicUser(updated);
    await this.cacheService.set(
      { entity: UsersService.USER_CACHE_ENTITY, id: userId },
      publicUser,
      { ttlSeconds: UsersService.USER_CACHE_TTL_SECONDS },
    );

    this.auditService.record('user.profile.photo.updated', {
      userId,
      traceId,
      metadata: {
        manifestKey: manifest.manifestKey,
      },
    });

    return publicUser;
  }

  async removeProfilePhoto(
    userId: string,
    traceId: string | undefined,
  ): Promise<PublicUser> {
    const existing = await this.usersRepository.findById(userId);
    if (!existing) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'User could not be found.',
      });
    }

    await this.safeDeleteMedia(existing.profilePhoto);

    const updated = await this.usersRepository.updateProfilePhoto(userId, null);
    if (!updated) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'User could not be found.',
      });
    }

    const publicUser = this.toPublicUser(updated);
    await this.cacheService.set(
      { entity: UsersService.USER_CACHE_ENTITY, id: userId },
      publicUser,
      { ttlSeconds: UsersService.USER_CACHE_TTL_SECONDS },
    );

    this.auditService.record('user.profile.photo.removed', {
      userId,
      traceId,
    });

    return publicUser;
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

    const record = this.toUserRecord(entity);
    await this.cacheService.set(
      { entity: UsersService.USER_CACHE_ENTITY, id: entity.id },
      record,
      { ttlSeconds: UsersService.USER_CACHE_TTL_SECONDS },
    );

    return record;
  }

  async findUserRecordById(userId: string): Promise<UserRecord | null> {
    const user = await this.getCachedPublicUser(userId);
    return user ? (user as UserRecord) : null;
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

  private toUserRecord(user: UserEntity | PublicUser): UserRecord {
    if (typeof (user as PublicUser).createdAt === 'string') {
      return user as UserRecord;
    }

    return this.toPublicUser(user as UserEntity);
  }

  private toProfile(user: UserEntity): UserProfile {
    return {
      displayName: user.displayName,
      locale: user.locale,
      bio: user.bio ?? undefined,
      photo: (user.profilePhoto as MediaManifest | undefined) ?? undefined,
    };
  }

  private async safeDeleteMedia(
    manifest: MediaManifest | null | undefined,
  ): Promise<void> {
    if (!manifest) {
      return;
    }

    try {
      await this.mediaService.deleteMedia(manifest);
    } catch (error) {
      this.logger.warn(
        `Failed to delete media manifest ${manifest.manifestKey}: ${(error as Error).message}`,
      );
    }
  }

  private async getCachedPublicUser(
    userId: string,
  ): Promise<PublicUser | null> {
    return this.cacheService.getOrSet<PublicUser>({
      entity: UsersService.USER_CACHE_ENTITY,
      id: userId,
      ttlSeconds: UsersService.USER_CACHE_TTL_SECONDS,
      loader: async () => {
        const entity = await this.usersRepository.findById(userId);
        return entity ? this.toPublicUser(entity) : null;
      },
    });
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
