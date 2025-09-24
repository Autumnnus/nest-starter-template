import type { Role } from 'src/common/types/role.enum';

export interface IUser {
  id: string;
  email: string;
  roles: Role[];
  sessionId: string;
}
