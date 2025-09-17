import { Role } from '../../common/types/role.enum';
import { ValidationException, Validator } from '../../common/utils/validation.util';

export interface ListUsersQuery {
  role?: Role;
  search?: string;
  page: number;
  limit: number;
}

export function validateListUsersQuery(query: Record<string, unknown>): ListUsersQuery {
  const errors: string[] = [];
  const source = Validator.ensureObject(query, errors);
  const roleInput = Validator.optionalString(source, 'role', errors);
  let role: Role | undefined;
  if (roleInput) {
    if (!Object.values(Role).includes(roleInput as Role)) {
      errors.push('role must be one of user, admin, moderator.');
    } else {
      role = roleInput as Role;
    }
  }
  const search = Validator.optionalString(source, 'search', errors, { maxLength: 120 });
  const page = Validator.optionalNumber(source, 'page', errors, { min: 1, integer: true }) ?? 1;
  const limit = Validator.optionalNumber(source, 'limit', errors, { min: 1, max: 100, integer: true }) ?? 10;

  if (errors.length > 0) {
    throw new ValidationException(errors);
  }

  return {
    role,
    search,
    page,
    limit,
  };
}
