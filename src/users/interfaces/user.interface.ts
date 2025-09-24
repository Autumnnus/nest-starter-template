import { type Role } from 'src/common/types/role.enum';

export interface UserProfile {
  displayName: string;
  locale: string;
  bio?: string;
}

export interface UserRecord {
  id: string;
  email: string;
  password: string;
  roles: Role[];
  profile: UserProfile;
  createdAt: string;
  updatedAt: string;
}

export interface PublicUser {
  id: string;
  email: string;
  roles: Role[];
  profile: UserProfile;
  createdAt: string;
  updatedAt: string;
}
