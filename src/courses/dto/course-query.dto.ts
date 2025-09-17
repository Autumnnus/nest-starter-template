import { ValidationException, Validator } from '../../common/utils/validation.util';

export interface CourseQuery {
  tag?: string;
  instructorId?: string;
  search?: string;
  page: number;
  limit: number;
  sort?: 'startsAt' | 'title';
}

export function validateCourseQuery(query: Record<string, unknown>): CourseQuery {
  const errors: string[] = [];
  const source = Validator.ensureObject(query, errors);
  const tag = Validator.optionalString(source, 'tag', errors, { maxLength: 40 });
  const instructorId = Validator.optionalString(source, 'instructorId', errors, { maxLength: 120 });
  const search = Validator.optionalString(source, 'search', errors, { maxLength: 120 });
  const sort = Validator.optionalString(source, 'sort', errors);
  let sortValue: 'startsAt' | 'title' | undefined;
  if (sort) {
    if (sort !== 'startsAt' && sort !== 'title') {
      errors.push('sort must be either startsAt or title.');
    } else {
      sortValue = sort;
    }
  }
  const page = Validator.optionalNumber(source, 'page', errors, { min: 1, integer: true }) ?? 1;
  const limit = Validator.optionalNumber(source, 'limit', errors, { min: 1, max: 50, integer: true }) ?? 10;

  if (errors.length > 0) {
    throw new ValidationException(errors);
  }

  return {
    tag,
    instructorId,
    search,
    page,
    limit,
    sort: sortValue,
  };
}
