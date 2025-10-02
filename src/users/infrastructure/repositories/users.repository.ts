import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ListUsersQueryDto } from 'src/users/dto/list-users.dto';
import { UpdateUserDto } from 'src/users/dto/update-user.dto';
import { UserEntity } from 'src/users/infrastructure/entities/user.entity';
import { Repository } from 'typeorm';

export interface PaginatedUsersResult {
  items: UserEntity[];
  total: number;
}

@Injectable()
export class UsersRepository {
  constructor(
    @InjectRepository(UserEntity)
    private readonly repository: Repository<UserEntity>,
  ) {}

  async findById(id: string): Promise<UserEntity | null> {
    return this.repository.findOne({ where: { id } });
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    return this.repository.findOne({
      where: { email: email.toLowerCase() },
    });
  }

  async paginate(query: ListUsersQueryDto): Promise<PaginatedUsersResult> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const qb = this.repository.createQueryBuilder('user');

    qb.orderBy('user.email', 'ASC');

    if (query.role) {
      qb.andWhere(':role = ANY(user.roles)', { role: query.role });
    }

    if (query.search) {
      const search = `%${query.search.toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(user.email) LIKE :search OR LOWER(user.profile_display_name) LIKE :search)',
        { search },
      );
    }

    qb.skip((page - 1) * limit).take(limit);

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  async updateProfile(
    userId: string,
    profile: UpdateUserDto['profile'],
  ): Promise<UserEntity | null> {
    const partial: Partial<UserEntity> = {};
    if (profile.displayName !== undefined) {
      partial.displayName = profile.displayName;
    }

    if (profile.locale !== undefined) {
      partial.locale = profile.locale;
    }

    if (profile.bio !== undefined) {
      partial.bio = profile.bio ?? null;
    }

    if (Object.keys(partial).length === 0) {
      return this.findById(userId);
    }

    await this.repository.update({ id: userId }, partial);
    return this.findById(userId);
  }

  async save(entity: UserEntity): Promise<UserEntity> {
    return this.repository.save(entity);
  }

  async count(): Promise<number> {
    return this.repository.count();
  }

  create(data: Partial<UserEntity>): UserEntity {
    return this.repository.create(data);
  }
}
