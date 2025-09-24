import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { Role } from '../../common/types/role.enum';
import { ensureRecord, runValidation, throwValidationException } from '../../common/utils/validation.util';

export class ListUsersQueryDto {
  @IsOptional()
  @IsEnum(Role, { message: 'role must be one of user, admin, moderator.' })
  role?: Role;

  @IsOptional()
  @IsString({ message: 'search must be a string.' })
  @IsNotEmpty({ message: 'search cannot be empty when provided.' })
  @MaxLength(120, { message: 'search must be at most 120 characters.' })
  search?: string;

  page = 1;
  limit = 10;
}

export type ListUsersQuery = ListUsersQueryDto;

export function validateListUsersQuery(query: Record<string, unknown>): ListUsersQueryDto {
  const errors: string[] = [];
  const source = ensureRecord(query, errors);

  const dto = new ListUsersQueryDto();
  Object.assign(dto, source);

  if (typeof dto.search === 'string') {
    dto.search = dto.search.trim();
  }

  const pageValue = source.page ?? dto.page;
  const limitValue = source.limit ?? dto.limit;

  const parsedPage = Number(pageValue);
  if (pageValue !== undefined) {
    if (Number.isNaN(parsedPage)) {
      errors.push('page must be a numeric value.');
    } else if (!Number.isInteger(parsedPage) || parsedPage < 1) {
      errors.push('page must be an integer greater than or equal to 1.');
    } else {
      dto.page = parsedPage;
    }
  }

  const parsedLimit = Number(limitValue);
  if (limitValue !== undefined) {
    if (Number.isNaN(parsedLimit)) {
      errors.push('limit must be a numeric value.');
    } else if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
      errors.push('limit must be an integer between 1 and 100.');
    } else {
      dto.limit = parsedLimit;
    }
  }

  runValidation(dto, errors);

  if (errors.length > 0) {
    throwValidationException(errors);
  }

  return dto;
}
