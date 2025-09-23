import {
  ValidationException,
  Validator,
} from '../../common/utils/validation.util';

export interface CreateSubmissionRequest {
  courseId: string;
  assignmentId: string;
  content: string;
  submittedAt: Date;
}

export function validateCreateSubmissionRequest(
  payload: unknown,
): CreateSubmissionRequest {
  const errors: string[] = [];
  const source = Validator.ensureObject(payload, errors);
  const courseId = Validator.requiredString(source, 'courseId', errors, {
    minLength: 3,
  });
  const assignmentId = Validator.requiredString(
    source,
    'assignmentId',
    errors,
    { minLength: 3 },
  );
  const content = Validator.requiredString(source, 'content', errors, {
    minLength: 10,
  });
  const submittedAt =
    Validator.optionalDate(source, 'submittedAt', errors) ?? new Date();

  if (errors.length > 0) {
    throw new ValidationException(errors);
  }

  return {
    courseId,
    assignmentId,
    content,
    submittedAt,
  };
}
