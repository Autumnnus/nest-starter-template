import {
  ValidationException,
  Validator,
} from 'src/common/utils/validation.util';
import { type UserProfile } from 'src/users/interfaces/user.interface';

export interface UpdateUserRequest {
  profile: Partial<UserProfile>;
}

export function validateUpdateUserRequest(payload: unknown): UpdateUserRequest {
  const errors: string[] = [];
  const source = Validator.ensureObject(payload, errors);

  const profileSource = source.profile;
  if (!profileSource || typeof profileSource !== 'object') {
    errors.push('profile is required and must be an object.');
  }

  const profileInput = (profileSource ?? {}) as Record<string, unknown>;
  const displayName = Validator.optionalString(
    profileInput,
    'displayName',
    errors,
    { minLength: 2, maxLength: 80 },
  );
  const locale = Validator.optionalString(profileInput, 'locale', errors, {
    pattern: /^[a-z]{2}-[A-Z]{2}$/,
  });
  const bio = Validator.optionalString(profileInput, 'bio', errors, {
    maxLength: 500,
  });

  if (errors.length > 0) {
    throw new ValidationException(errors);
  }

  const profile: Partial<UserProfile> = {};
  if (displayName !== undefined) {
    profile.displayName = displayName;
  }

  if (locale !== undefined) {
    profile.locale = locale;
  }

  if (bio !== undefined) {
    profile.bio = bio;
  }

  return { profile };
}
