import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ensureRecord, runValidation, throwValidationException } from '../../common/utils/validation.util';

const ISO_DATE_REGEX = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)$/;

export class CreateCourseLessonDto {
  @IsString({ message: 'lessons.title must be a string.' })
  @IsNotEmpty({ message: 'lessons.title is required and must be a non-empty string.' })
  @MinLength(3, { message: 'lessons.title must be at least 3 characters.' })
  @MaxLength(160, { message: 'lessons.title must be at most 160 characters.' })
  title!: string;

  @Min(5, { message: 'lessons.durationMinutes must be greater than or equal to 5.' })
  @Max(600, { message: 'lessons.durationMinutes must be less than or equal to 600.' })
  durationMinutes!: number;
}

export class CreateCourseDto {
  @IsString({ message: 'title must be a string.' })
  @IsNotEmpty({ message: 'title is required and must be a non-empty string.' })
  @MinLength(4, { message: 'title must be at least 4 characters.' })
  @MaxLength(160, { message: 'title must be at most 160 characters.' })
  title!: string;

  @IsString({ message: 'description must be a string.' })
  @IsNotEmpty({ message: 'description is required and must be a non-empty string.' })
  @MinLength(10, { message: 'description must be at least 10 characters.' })
  description!: string;

  @IsOptional()
  @IsArray({ message: 'tags must be an array of strings when provided.' })
  tags?: string[];

  @IsString({ message: 'startsAt must be a string.' })
  @IsNotEmpty({ message: 'startsAt is required and must be a non-empty string.' })
  startsAt!: string;

  @IsString({ message: 'endsAt must be a string.' })
  @IsNotEmpty({ message: 'endsAt is required and must be a non-empty string.' })
  endsAt!: string;

  @IsString({ message: 'instructorId must be a string.' })
  @IsNotEmpty({ message: 'instructorId is required and must be a non-empty string.' })
  @MinLength(3, { message: 'instructorId must be at least 3 characters.' })
  instructorId!: string;

  @Min(1, { message: 'capacity must be greater than or equal to 1.' })
  @Max(500, { message: 'capacity must be less than or equal to 500.' })
  capacity: number = 50;

  lessons: CreateCourseLessonDto[] = [];
}

export interface CreateCourseRequest {
  title: string;
  description: string;
  tags: string[];
  startsAt: Date;
  endsAt: Date;
  instructorId: string;
  capacity: number;
  lessons: { title: string; durationMinutes: number }[];
}

export function validateCreateCourseRequest(payload: unknown): CreateCourseRequest {
  const errors: string[] = [];
  const source = ensureRecord(payload, errors);

  const dto = new CreateCourseDto();
  Object.assign(dto, source);

  dto.title = typeof dto.title === 'string' ? dto.title.trim() : dto.title;
  dto.description = typeof dto.description === 'string' ? dto.description.trim() : dto.description;
  dto.instructorId = typeof dto.instructorId === 'string' ? dto.instructorId.trim() : dto.instructorId;
  dto.startsAt = typeof dto.startsAt === 'string' ? dto.startsAt.trim() : dto.startsAt;
  dto.endsAt = typeof dto.endsAt === 'string' ? dto.endsAt.trim() : dto.endsAt;

  if (source.capacity !== undefined) {
    const numericCapacity = Number(source.capacity);
    if (Number.isNaN(numericCapacity)) {
      errors.push('capacity must be a numeric value.');
    } else {
      dto.capacity = numericCapacity;
      if (!Number.isInteger(dto.capacity)) {
        errors.push('capacity must be an integer.');
      }
    }
  }

  if (!ISO_DATE_REGEX.test(dto.startsAt ?? '')) {
    errors.push('startsAt must be a valid ISO 8601 date.');
  }
  if (!ISO_DATE_REGEX.test(dto.endsAt ?? '')) {
    errors.push('endsAt must be a valid ISO 8601 date.');
  }

  if (source.tags !== undefined) {
    if (!Array.isArray(source.tags)) {
      errors.push('tags must be an array of strings when provided.');
    } else {
      dto.tags = source.tags
        .map((tag) => (typeof tag === 'string' ? tag.trim() : tag))
        .filter((tag): tag is string => typeof tag === 'string' && tag.length > 0);
      if (dto.tags.length !== source.tags.length) {
        errors.push('tags must only include non-empty strings.');
      }
    }
  } else {
    dto.tags = [];
  }

  if (!Array.isArray(source.lessons) || source.lessons.length === 0) {
    errors.push('lessons must be a non-empty array.');
  } else {
    dto.lessons = source.lessons.map((lesson, index) => {
      if (!lesson || typeof lesson !== 'object' || Array.isArray(lesson)) {
        errors.push(`lessons[${index}] must be an object.`);
        return undefined;
      }
      const lessonDto = new CreateCourseLessonDto();
      const record = lesson as Record<string, unknown>;
      lessonDto.title = typeof record.title === 'string' ? record.title.trim() : (record.title as string);
      const durationValue = Number(record.durationMinutes);
      if (Number.isNaN(durationValue)) {
        errors.push(`lessons[${index}].durationMinutes must be a numeric value.`);
      } else {
        lessonDto.durationMinutes = durationValue;
        if (!Number.isInteger(durationValue)) {
          errors.push(`lessons[${index}].durationMinutes must be an integer.`);
        }
      }
      runValidation(lessonDto, errors);
      return lessonDto;
    }).filter((lesson): lesson is CreateCourseLessonDto => !!lesson);
  }

  runValidation(dto, errors);

  if (errors.length > 0) {
    throwValidationException(errors);
  }

  const startsAtDate = new Date(dto.startsAt);
  const endsAtDate = new Date(dto.endsAt);

  if (startsAtDate >= endsAtDate) {
    throwValidationException(['endsAt must be later than startsAt.']);
  }

  return {
    title: dto.title,
    description: dto.description,
    tags: dto.tags ?? [],
    startsAt: startsAtDate,
    endsAt: endsAtDate,
    instructorId: dto.instructorId,
    capacity: dto.capacity ?? 50,
    lessons: dto.lessons.map((lesson) => ({
      title: lesson.title,
      durationMinutes: lesson.durationMinutes,
    })),
  };
}
