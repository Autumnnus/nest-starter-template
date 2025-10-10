import type { Role } from 'src/common/types/role.enum';

export const USER_SCOPE_METADATA_KEY = 'user-scope';

export interface UserScopeOptions {
  paramKey?: string;
  allowRoles?: Role[];
}

export interface ResolvedUserScopeOptions {
  paramKey: string;
  allowRoles: Role[];
}
