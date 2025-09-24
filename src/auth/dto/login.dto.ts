import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ensureRecord, runValidation, throwValidationException } from '../../common/utils/validation.util';

export class LoginDto {
  @IsEmail({ message: 'email must be a valid email address.' })
  @IsNotEmpty({ message: 'email is required and must be a non-empty string.' })
  email!: string;

  @IsString({ message: 'password must be a string.' })
  @IsNotEmpty({ message: 'password is required and must be a non-empty string.' })
  @MinLength(6, { message: 'password must be at least 6 characters.' })
  password!: string;

  @IsOptional()
  @IsString({ message: 'deviceId must be a string when provided.' })
  @IsNotEmpty({ message: 'deviceId cannot be empty when provided.' })
  deviceId?: string;

  @IsOptional()
  @IsString({ message: 'deviceName must be a string when provided.' })
  @IsNotEmpty({ message: 'deviceName cannot be empty when provided.' })
  @MaxLength(120, { message: 'deviceName must be at most 120 characters.' })
  deviceName?: string;
}

export type LoginRequest = LoginDto;

export function validateLoginRequest(payload: unknown): LoginDto {
  const errors: string[] = [];
  const source = ensureRecord(payload, errors);

  const dto = new LoginDto();
  Object.assign(dto, source);

  if (typeof dto.email === 'string') {
    dto.email = dto.email.trim().toLowerCase();
  }
  if (typeof dto.password === 'string') {
    dto.password = dto.password.trim();
  }
  if (typeof dto.deviceId === 'string') {
    dto.deviceId = dto.deviceId.trim();
  }
  if (typeof dto.deviceName === 'string') {
    dto.deviceName = dto.deviceName.trim();
  }

  runValidation(dto, errors);

  if (errors.length > 0) {
    throwValidationException(errors);
  }

  return dto;
}
