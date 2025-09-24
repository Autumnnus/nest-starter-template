import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SessionStore } from './session.store';

@Module({
  imports: [UsersModule, CommonModule],
  controllers: [AuthController],
  providers: [AuthService, SessionStore],
  exports: [AuthService],
})
export class AuthModule {}
