import { IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { ensureRecord, runValidation, throwValidationException } from '../../common/utils/validation.util';

const ISO_DATE_REGEX = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)$/;

export class CreateSubmissionDto {
  @IsString({ message: 'courseId must be a string.' })
  @IsNotEmpty({ message: 'courseId is required and must be a non-empty string.' })
  @MinLength(3, { message: 'courseId must be at least 3 characters.' })
  courseId!: string;

  @IsString({ message: 'assignmentId must be a string.' })
  @IsNotEmpty({ message: 'assignmentId is required and must be a non-empty string.' })
  @MinLength(3, { message: 'assignmentId must be at least 3 characters.' })
  assignmentId!: string;

  @IsString({ message: 'content must be a string.' })
  @IsNotEmpty({ message: 'content is required and must be a non-empty string.' })
  @MinLength(10, { message: 'content must be at least 10 characters.' })
  content!: string;

  @IsOptional()
  @IsString({ message: 'submittedAt must be a string when provided.' })
  submittedAt?: string;
}

export interface CreateSubmissionRequest {
  courseId: string;
  assignmentId: string;
  content: string;
  submittedAt: Date;
}

export function validateCreateSubmissionRequest(payload: unknown): CreateSubmissionRequest {
  const errors: string[] = [];
  const source = ensureRecord(payload, errors);

  const dto = new CreateSubmissionDto();
  Object.assign(dto, source);

  dto.courseId = typeof dto.courseId === 'string' ? dto.courseId.trim() : dto.courseId;
  dto.assignmentId = typeof dto.assignmentId === 'string' ? dto.assignmentId.trim() : dto.assignmentId;
  dto.content = typeof dto.content === 'string' ? dto.content.trim() : dto.content;
  dto.submittedAt = typeof dto.submittedAt === 'string' ? dto.submittedAt.trim() : dto.submittedAt;

  if (dto.submittedAt && !ISO_DATE_REGEX.test(dto.submittedAt)) {
    errors.push('submittedAt must be a valid ISO 8601 date when provided.');
  }

  runValidation(dto, errors);

  if (errors.length > 0) {
    throwValidationException(errors);
  }

  const submittedAt = dto.submittedAt ? new Date(dto.submittedAt) : new Date();

  return {
    courseId: dto.courseId,
    assignmentId: dto.assignmentId,
    content: dto.content,
    submittedAt,
  };
}
