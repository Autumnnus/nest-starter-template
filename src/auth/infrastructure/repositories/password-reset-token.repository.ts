import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PasswordResetTokenEntity } from 'src/auth/infrastructure/entities/password-reset-token.entity';
import { Repository } from 'typeorm';

@Injectable()
export class PasswordResetTokenRepository {
  constructor(
    @InjectRepository(PasswordResetTokenEntity)
    private readonly repository: Repository<PasswordResetTokenEntity>,
  ) {}

  async createToken(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<PasswordResetTokenEntity> {
    const entity = this.repository.create({
      userId,
      tokenHash,
      expiresAt,
    });

    return this.repository.save(entity);
  }

  async findValidByTokenHash(
    tokenHash: string,
  ): Promise<PasswordResetTokenEntity | null> {
    return this.repository.findOne({
      where: {
        tokenHash,
        consumedAt: undefined,
      },
    });
  }

  async markConsumed(id: string, consumedAt: Date): Promise<void> {
    await this.repository.update({ id }, { consumedAt });
  }

  async invalidateForUser(userId: string): Promise<void> {
    await this.repository.delete({ userId });
  }
}
