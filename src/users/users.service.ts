import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import { AuditService } from 'src/common/services/audit.service';
import { Role } from 'src/common/types/role.enum';
import { PaginatedResult } from 'src/common/utils/pagination.util';
import { MediaService } from 'src/media/media.service';
import { CacheService } from 'src/redis/cache.service';
import { ListUsersQueryDto } from 'src/users/dto/list-users.dto';
import { UpdateUserDto } from 'src/users/dto/update-user.dto';
import { UserEntity } from 'src/users/infrastructure/entities/user.entity';
import {
  UpdateProfileInput,
  UsersRepository,
} from 'src/users/infrastructure/repositories/users.repository';
import {
  PublicUser,
  UserProfile,
  UserRecord,
} from 'src/users/interfaces/user.interface';

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
    photoFile?: Express.Multer.File,
  ): Promise<PublicUser> {
    const existing = await this.usersRepository.findById(userId);
    if (!existing) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'User could not be found.',
      });
    }

    const profile = request.profile ?? {};
    const updates: UpdateProfileInput = {};
    const updatedFields = new Set<string>();

    if (profile.displayName !== undefined) {
      updates.displayName = profile.displayName;
      updatedFields.add('profile.displayName');
    }

    if (profile.locale !== undefined) {
      updates.locale = profile.locale;
      updatedFields.add('profile.locale');
    }

    if (profile.bio !== undefined) {
      updates.bio = profile.bio ?? null;
      updatedFields.add('profile.bio');
    }

    if (photoFile) {
      const [manifest] = await this.mediaService.uploadMedia([photoFile], {
        purpose: 'avatar',
      });
      updates.profilePhotoKey = manifest.manifestKey;
      updatedFields.add('profile.photo');

      // Ensure old media is removed once the update succeeds.
      const updated = await this.persistProfileUpdates(userId, updates);
      await this.safeDeleteMedia(existing.profilePhotoKey);

      return this.afterProfileUpdate(
        userId,
        updated,
        traceId,
        Array.from(updatedFields),
      );
    }

    if (profile.photo === null) {
      updates.profilePhotoKey = null;
      updatedFields.add('profile.photo');
    }

    const updated = await this.persistProfileUpdates(userId, updates);
    if (profile.photo === null) {
      await this.safeDeleteMedia(existing.profilePhotoKey);
    }

    return this.afterProfileUpdate(
      userId,
      updated,
      traceId,
      Array.from(updatedFields),
    );
  }

  private async persistProfileUpdates(
    userId: string,
    updates: UpdateProfileInput,
  ): Promise<UserEntity> {
    const record = await this.usersRepository.updateProfile(userId, updates);
    if (!record) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'User could not be found.',
      });
    }

    return record;
  }

  private async afterProfileUpdate(
    userId: string,
    updated: UserEntity,
    traceId: string | undefined,
    updatedFields: string[],
  ): Promise<PublicUser> {
    const publicUser = this.toPublicUser(updated);
    await this.cacheService.set(
      { entity: UsersService.USER_CACHE_ENTITY, id: userId },
      publicUser,
      { ttlSeconds: UsersService.USER_CACHE_TTL_SECONDS },
    );

    this.auditService.record('user.profile.updated', {
      userId,
      traceId,
      metadata: { updatedFields },
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
    await this.cacheUserRecord(record);

    return record;
  }

  async findUserRecordById(userId: string): Promise<UserRecord | null> {
    const user = await this.getCachedPublicUser(userId);
    return user || null;
  }

  async findUserRecordByEmail(email: string): Promise<UserRecord | null> {
    const entity = await this.usersRepository.findByEmail(email.toLowerCase());
    if (!entity) {
      return null;
    }

    const record = this.toUserRecord(entity);
    await this.cacheUserRecord(record);
    return record;
  }

  async updatePassword(
    userId: string,
    newPassword: string,
    traceId: string | undefined,
    reason: 'reset' | 'change',
  ): Promise<void> {
    const passwordHash = await argon2.hash(newPassword);
    const updated = await this.usersRepository.updatePassword(
      userId,
      passwordHash,
    );
    if (!updated) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'User could not be found.',
      });
    }

    await this.invalidateUserCache(userId);
    this.auditService.record('user.password.updated', {
      userId,
      traceId,
      metadata: { reason },
    });
  }

  async updateEmail(
    userId: string,
    newEmail: string,
    traceId: string | undefined,
  ): Promise<PublicUser> {
    const existing = await this.usersRepository.findById(userId);
    if (!existing) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'User could not be found.',
      });
    }

    if (existing.email === newEmail) {
      throw new BadRequestException({
        code: 'EMAIL_UNCHANGED',
        message: 'Yeni e-posta adresi mevcut adres ile aynı olamaz.',
      });
    }

    const other = await this.usersRepository.findByEmail(newEmail);
    if (other && other.id !== userId) {
      throw new ConflictException({
        code: 'EMAIL_ALREADY_IN_USE',
        message:
          'Bu e-posta adresi başka bir kullanıcı tarafından kullanılıyor.',
      });
    }

    const updated = await this.usersRepository.updateEmail(userId, newEmail);
    if (!updated) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'User could not be found.',
      });
    }

    const publicUser = this.toPublicUser(updated);
    await this.cacheUserRecord(publicUser);
    this.auditService.record('user.email.updated', {
      userId,
      traceId,
      metadata: {
        previousEmail: existing.email,
        newEmail,
      },
    });

    return publicUser;
  }

  async createOAuthUser(input: {
    email: string;
    displayName?: string;
    locale?: string;
  }): Promise<UserRecord> {
    const normalizedEmail = input.email.toLowerCase();
    const existing = await this.usersRepository.findByEmail(normalizedEmail);
    if (existing) {
      const record = this.toUserRecord(existing);
      await this.cacheUserRecord(record);
      return record;
    }

    const passwordSeed = randomBytes(32).toString('hex');
    const passwordHash = await argon2.hash(passwordSeed);
    const entity = this.usersRepository.create({
      email: normalizedEmail,
      passwordHash,
      roles: [Role.User],
      displayName:
        input.displayName?.trim() || normalizedEmail.split('@')[0] || 'User',
      locale: input.locale ?? 'en-US',
      bio: null,
    });

    const saved = await this.usersRepository.save(entity);
    const record = this.toUserRecord(saved);
    await this.cacheUserRecord(record);
    this.auditService.record('user.account.created', {
      userId: saved.id,
      metadata: { provider: 'google-oauth' },
    });

    return record;
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
      photo: user.profilePhotoKey ?? undefined,
    };
  }

  private async safeDeleteMedia(
    manifestKey: string | null | undefined,
  ): Promise<void> {
    if (!manifestKey) {
      return;
    }

    try {
      await this.mediaService.deleteMediaByManifestKey(manifestKey);
    } catch (error) {
      this.logger.warn(
        `Failed to delete media manifest ${manifestKey}: ${(error as Error).message}`,
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

  private async cacheUserRecord(record: PublicUser): Promise<void> {
    await this.cacheService.set(
      { entity: UsersService.USER_CACHE_ENTITY, id: record.id },
      record,
      { ttlSeconds: UsersService.USER_CACHE_TTL_SECONDS },
    );
  }

  private async invalidateUserCache(userId: string): Promise<void> {
    await this.cacheService.delete({
      entity: UsersService.USER_CACHE_ENTITY,
      id: userId,
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
