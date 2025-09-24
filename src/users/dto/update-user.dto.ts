import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { ensureRecord, runValidation, throwValidationException } from '../../common/utils/validation.util';
import { UserProfile } from '../interfaces/user.interface';

export class UpdateUserProfileDto {
  @IsOptional()
  @IsString({ message: 'profile.displayName must be a string when provided.' })
  @IsNotEmpty({ message: 'profile.displayName cannot be empty when provided.' })
  @MinLength(2, { message: 'profile.displayName must be at least 2 characters.' })
  @MaxLength(80, { message: 'profile.displayName must be at most 80 characters.' })
  displayName?: string;

  @IsOptional()
  @IsString({ message: 'profile.locale must be a string when provided.' })
  @Matches(/^[a-z]{2}-[A-Z]{2}$/, {
    message: 'profile.locale must match the pattern ll-CC (e.g. en-US).',
  })
  locale?: string;

  @IsOptional()
  @IsString({ message: 'profile.bio must be a string when provided.' })
  @MaxLength(500, { message: 'profile.bio must be at most 500 characters.' })
  bio?: string;
}

export class UpdateUserDto {
  profile!: UpdateUserProfileDto;
}

export interface UpdateUserRequest {
  profile: Partial<UserProfile>;
}

export function validateUpdateUserRequest(payload: unknown): UpdateUserRequest {
  const errors: string[] = [];
  const source = ensureRecord(payload, errors);

  const profileSource = source.profile;
  if (!profileSource || typeof profileSource !== 'object' || Array.isArray(profileSource)) {
    errors.push('profile is required and must be an object.');
    throwValidationException(errors);
  }

  const profileDto = new UpdateUserProfileDto();
  Object.assign(profileDto, profileSource as Record<string, unknown>);

  if (typeof profileDto.displayName === 'string') {
    profileDto.displayName = profileDto.displayName.trim();
  }
  if (typeof profileDto.locale === 'string') {
    profileDto.locale = profileDto.locale.trim();
  }
  if (typeof profileDto.bio === 'string') {
    profileDto.bio = profileDto.bio.trim();
  }

  runValidation(profileDto, errors);

  if (errors.length > 0) {
    throwValidationException(errors);
  }

  const profile: Partial<UserProfile> = {};
  if (profileDto.displayName !== undefined) {
    profile.displayName = profileDto.displayName;
  }
  if (profileDto.locale !== undefined) {
    profile.locale = profileDto.locale;
  }
  if (profileDto.bio !== undefined) {
    profile.bio = profileDto.bio;
  }

  return { profile };
}
