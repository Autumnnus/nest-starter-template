import { Module } from '@nestjs/common';
import { AuthController } from 'src/auth/auth.controller';
import { AuthService } from 'src/auth/auth.service';
import { SessionStore } from 'src/auth/session.store';
import { CommonModule } from 'src/common/common.module';
import { UsersModule } from 'src/users/users.module';

@Module({
  imports: [UsersModule, CommonModule],
  controllers: [AuthController],
  providers: [AuthService, SessionStore],
  exports: [AuthService],
})
export class AuthModule {}
