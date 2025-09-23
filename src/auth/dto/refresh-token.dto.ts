import {
  ValidationException,
  Validator,
} from 'src/common/utils/validation.util';

export interface RefreshTokenRequest {
  refreshToken: string;
}

export function validateRefreshTokenRequest(
  payload: unknown,
): RefreshTokenRequest {
  const errors: string[] = [];
  const source = Validator.ensureObject(payload, errors);
  const refreshToken = Validator.requiredString(
    source,
    'refreshToken',
    errors,
    { minLength: 10 },
  );

  if (errors.length > 0) {
    throw new ValidationException(errors);
  }

  return { refreshToken };
}
