import { BadRequestException } from '@nestjs/common';
import { ValidationError, validateSync } from 'class-validator';

const DEFAULT_ERROR_MESSAGE = 'Payload validation failed';

export function ensureRecord(payload: unknown, errors: string[]): Record<string, unknown> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    errors.push('Payload must be a JSON object.');
    return {};
  }
  return payload as Record<string, unknown>;
}

export function runValidation<T extends object>(instance: T, errors: string[]) {
  const validationErrors = validateSync(instance);
  if (validationErrors.length > 0) {
    errors.push(...formatValidationErrors(validationErrors));
  }
}

export function formatValidationErrors(validationErrors: ValidationError[]): string[] {
  const messages: string[] = [];
  const stack: { error: ValidationError; path: string }[] = [];
  validationErrors.forEach((error) => stack.push({ error, path: error.property }));

  while (stack.length > 0) {
    const { error, path } = stack.pop()!;
    if (error.constraints) {
      Object.values(error.constraints).forEach((message) => {
        messages.push(message.replace(error.property, path));
      });
    }
    if (error.children) {
      error.children.forEach((child) => {
        const childPath = child.property.match(/^\d+$/)
          ? `${path}[${child.property}]`
          : `${path}.${child.property}`;
        stack.push({ error: child, path: childPath });
      });
    }
  }

  return messages;
}

export function throwValidationException(errors: string[]): never {
  throw new BadRequestException({
    code: 'VALIDATION_ERROR',
    message: DEFAULT_ERROR_MESSAGE,
    details: errors,
  });
}
