import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ensureRecord, runValidation, throwValidationException } from '../../common/utils/validation.util';

export class RefreshTokenDto {
  @IsString({ message: 'refreshToken must be a string.' })
  @IsNotEmpty({ message: 'refreshToken is required and must be a non-empty string.' })
  @MinLength(10, { message: 'refreshToken must be at least 10 characters.' })
  refreshToken!: string;
}

export type RefreshTokenRequest = RefreshTokenDto;

export function validateRefreshTokenRequest(payload: unknown): RefreshTokenDto {
  const errors: string[] = [];
  const source = ensureRecord(payload, errors);

  const dto = new RefreshTokenDto();
  Object.assign(dto, source);

  if (typeof dto.refreshToken === 'string') {
    dto.refreshToken = dto.refreshToken.trim();
  }

  runValidation(dto, errors);

  if (errors.length > 0) {
    throwValidationException(errors);
  }

  return dto;
}
