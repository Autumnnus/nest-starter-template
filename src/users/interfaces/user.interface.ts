import { type Role } from 'src/common/types/role.enum';

export interface UserProfile {
  displayName: string;
  locale: string;
  bio?: string;
  photo?: string;
}

export interface PublicUser {
  id: string;
  email: string;
  roles: Role[];
  profile: UserProfile;
  createdAt: string;
  updatedAt: string;
}

export type UserRecord = PublicUser;
