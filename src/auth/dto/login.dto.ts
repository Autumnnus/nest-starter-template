import {
  ValidationException,
  Validator,
} from 'src/common/utils/validation.util';

export interface LoginRequest {
  email: string;
  password: string;
  deviceId?: string;
  deviceName?: string;
}

export function validateLoginRequest(payload: unknown): LoginRequest {
  const errors: string[] = [];
  const source = Validator.ensureObject(payload, errors);
  const email = Validator.requiredString(source, 'email', errors, {
    format: 'email',
  });
  const password = Validator.requiredString(source, 'password', errors, {
    minLength: 6,
  });
  const deviceId = Validator.optionalString(source, 'deviceId', errors);
  const deviceName = Validator.optionalString(source, 'deviceName', errors, {
    maxLength: 120,
  });

  if (errors.length > 0) {
    throw new ValidationException(errors);
  }

  return { email: email.toLowerCase(), password, deviceId, deviceName };
}
