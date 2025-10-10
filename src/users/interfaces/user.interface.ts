import { type Role } from 'src/common/types/role.enum';

import type { MediaManifest } from 'src/media/interfaces/media-manifest.interface';

export interface UserProfile {
  displayName: string;
  locale: string;
  bio?: string;
  photo?: MediaManifest;
}

export interface PublicUser {
  id: string;
  email: string;
  roles: Role[];
  profile: UserProfile;
  createdAt: string;
  updatedAt: string;
}

export interface UserRecord extends PublicUser {}
