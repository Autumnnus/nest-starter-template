import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from 'src/auth/auth.controller';
import { AuthService } from 'src/auth/auth.service';
import { AuthSessionEntity } from 'src/auth/infrastructure/entities/auth-session.entity';
import { EmailChangeRequestEntity } from 'src/auth/infrastructure/entities/email-change-request.entity';
import { PasswordResetTokenEntity } from 'src/auth/infrastructure/entities/password-reset-token.entity';
import { EmailChangeRequestRepository } from 'src/auth/infrastructure/repositories/email-change-request.repository';
import { PasswordResetTokenRepository } from 'src/auth/infrastructure/repositories/password-reset-token.repository';
import { SessionStore } from 'src/auth/session.store';
import { CommonModule } from 'src/common/common.module';
import { MailModule } from 'src/mail/mail.module';
import { UsersModule } from 'src/users/users.module';

@Module({
  imports: [
    UsersModule,
    CommonModule,
    MailModule,
    TypeOrmModule.forFeature([
      AuthSessionEntity,
      PasswordResetTokenEntity,
      EmailChangeRequestEntity,
    ]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    SessionStore,
    PasswordResetTokenRepository,
    EmailChangeRequestRepository,
  ],
  exports: [AuthService],
})
export class AuthModule {}
