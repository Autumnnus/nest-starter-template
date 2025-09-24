import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ensureRecord, runValidation, throwValidationException } from '../../common/utils/validation.util';

export class CourseQueryDto {
  @IsOptional()
  @IsString({ message: 'tag must be a string.' })
  @IsNotEmpty({ message: 'tag cannot be empty when provided.' })
  @MaxLength(40, { message: 'tag must be at most 40 characters.' })
  tag?: string;

  @IsOptional()
  @IsString({ message: 'instructorId must be a string.' })
  @IsNotEmpty({ message: 'instructorId cannot be empty when provided.' })
  @MaxLength(120, { message: 'instructorId must be at most 120 characters.' })
  instructorId?: string;

  @IsOptional()
  @IsString({ message: 'search must be a string.' })
  @IsNotEmpty({ message: 'search cannot be empty when provided.' })
  @MaxLength(120, { message: 'search must be at most 120 characters.' })
  search?: string;

  page = 1;
  limit = 10;
  sort?: 'startsAt' | 'title';
}

export type CourseQuery = CourseQueryDto;

export function validateCourseQuery(query: Record<string, unknown>): CourseQueryDto {
  const errors: string[] = [];
  const source = ensureRecord(query, errors);

  const dto = new CourseQueryDto();
  Object.assign(dto, source);

  if (typeof dto.tag === 'string') {
    dto.tag = dto.tag.trim();
  }
  if (typeof dto.instructorId === 'string') {
    dto.instructorId = dto.instructorId.trim();
  }
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
    } else if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 50) {
      errors.push('limit must be an integer between 1 and 50.');
    } else {
      dto.limit = parsedLimit;
    }
  }

  if (source.sort !== undefined) {
    if (source.sort === 'startsAt' || source.sort === 'title') {
      dto.sort = source.sort as 'startsAt' | 'title';
    } else if (Array.isArray(source.sort)) {
      errors.push('sort must be a single value.');
    } else {
      errors.push('sort must be either startsAt or title.');
    }
  }

  runValidation(dto, errors);

  if (errors.length > 0) {
    throwValidationException(errors);
  }

  return dto;
}
