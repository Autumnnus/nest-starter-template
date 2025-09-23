import {
  ValidationException,
  Validator,
} from '../../common/utils/validation.util';

export interface CreateCourseLessonInput {
  title: string;
  durationMinutes: number;
}

export interface CreateCourseRequest {
  title: string;
  description: string;
  tags: string[];
  startsAt: Date;
  endsAt: Date;
  instructorId: string;
  capacity: number;
  lessons: CreateCourseLessonInput[];
}

export function validateCreateCourseRequest(
  payload: unknown,
): CreateCourseRequest {
  const errors: string[] = [];
  const source = Validator.ensureObject(payload, errors);
  const title = Validator.requiredString(source, 'title', errors, {
    minLength: 4,
    maxLength: 160,
  });
  const description = Validator.requiredString(source, 'description', errors, {
    minLength: 10,
  });
  const tags = Validator.optionalStringArray(source, 'tags', errors) ?? [];
  const startsAt = Validator.requiredDate(source, 'startsAt', errors);
  const endsAt = Validator.requiredDate(source, 'endsAt', errors);
  const instructorId = Validator.requiredString(
    source,
    'instructorId',
    errors,
    { minLength: 3 },
  );
  const capacity =
    Validator.optionalNumber(source, 'capacity', errors, {
      min: 1,
      max: 500,
      integer: true,
    }) ?? 50;

  const lessonsSource = source.lessons;
  if (!Array.isArray(lessonsSource) || lessonsSource.length === 0) {
    errors.push('lessons must be a non-empty array.');
  }

  const lessons: CreateCourseLessonInput[] = [];
  if (Array.isArray(lessonsSource)) {
    lessonsSource.forEach((lesson, index) => {
      if (!lesson || typeof lesson !== 'object') {
        errors.push(`lessons[${index}] must be an object.`);
        return;
      }
      const lessonRecord = lesson as Record<string, unknown>;
      const lessonTitle = Validator.requiredString(
        lessonRecord,
        'title',
        errors,
        { minLength: 3, maxLength: 160 },
      );
      const duration = Validator.optionalNumber(
        lessonRecord,
        'durationMinutes',
        errors,
        {
          min: 5,
          max: 600,
        },
      );
      if (duration === undefined) {
        errors.push(`lessons[${index}].durationMinutes is required.`);
        return;
      }
      lessons.push({ title: lessonTitle, durationMinutes: duration });
    });
  }

  if (startsAt >= endsAt) {
    errors.push('endsAt must be later than startsAt.');
  }

  if (errors.length > 0) {
    throw new ValidationException(errors);
  }

  return {
    title,
    description,
    tags,
    startsAt,
    endsAt,
    instructorId,
    capacity,
    lessons,
  };
}
