import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SessionDeviceInfo } from 'src/auth/domain/session.types';

@Entity({ name: 'auth_sessions' })
@Index('IDX_auth_sessions_refresh_token', ['refreshToken'], { unique: true })
@Index('IDX_auth_sessions_user_id', ['userId'])
export class AuthSessionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'refresh_token', type: 'varchar', length: 192 })
  refreshToken!: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'last_accessed_at', type: 'timestamptz' })
  lastAccessedAt!: Date;

  @Column({ type: 'jsonb', nullable: true })
  device?: SessionDeviceInfo;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
