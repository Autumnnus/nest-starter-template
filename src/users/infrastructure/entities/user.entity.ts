import { Role } from 'src/common/types/role.enum';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'users' })
@Index('IDX_users_email', ['email'], { unique: true })
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    type: 'varchar',
    length: 160,
    transformer: {
      to: (value: string) => value.toLowerCase(),
      from: (value: string) => value,
    },
  })
  email!: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 255 })
  passwordHash!: string;

  @Column({ type: 'enum', enum: Role, array: true, default: [Role.User] })
  roles!: Role[];

  @Column({ name: 'profile_display_name', type: 'varchar', length: 80 })
  displayName!: string;

  @Column({
    name: 'profile_locale',
    type: 'varchar',
    length: 10,
    default: 'en-US',
  })
  locale!: string;

  @Column({ name: 'profile_bio', type: 'text', nullable: true })
  bio?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
