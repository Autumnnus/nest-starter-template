import { Role } from '../../common/types/role.enum';

export interface AuthenticatedUser {
  id: string;
  email: string;
  roles: Role[];
  sessionId: string;
}
