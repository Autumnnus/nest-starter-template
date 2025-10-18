import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EmailChangeRequestEntity } from 'src/auth/infrastructure/entities/email-change-request.entity';
import { Repository } from 'typeorm';

@Injectable()
export class EmailChangeRequestRepository {
  constructor(
    @InjectRepository(EmailChangeRequestEntity)
    private readonly repository: Repository<EmailChangeRequestEntity>,
  ) {}

  async createRequest(
    userId: string,
    newEmail: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<EmailChangeRequestEntity> {
    const entity = this.repository.create({
      userId,
      newEmail,
      tokenHash,
      expiresAt,
    });

    return this.repository.save(entity);
  }

  async invalidateOpenRequests(userId: string): Promise<void> {
    await this.repository.delete({ userId });
  }

  async findValidByTokenHash(
    tokenHash: string,
  ): Promise<EmailChangeRequestEntity | null> {
    return this.repository.findOne({
      where: {
        tokenHash,
        confirmedAt: undefined,
      },
    });
  }

  async markConfirmed(id: string, confirmedAt: Date): Promise<void> {
    await this.repository.update({ id }, { confirmedAt });
  }
}
