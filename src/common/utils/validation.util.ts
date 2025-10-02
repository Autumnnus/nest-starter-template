import { BadRequestException } from '@nestjs/common';
import type { ValidationError } from 'class-validator';

export class ValidationException extends BadRequestException {
  constructor(errors: string[]) {
    super({
      code: 'VALIDATION_ERROR',
      message: 'Payload validation failed',
      details: errors,
    });
  }
}

export const extractValidationMessages = (
  validationErrors: ValidationError[],
): string[] => {
  const messages: string[] = [];

  const traverse = (error: ValidationError, parentPath?: string) => {
    const propertyPath = parentPath
      ? `${parentPath}.${error.property}`
      : error.property;

    if (error.constraints) {
      for (const message of Object.values(error.constraints)) {
        if (propertyPath) {
          messages.push(`${propertyPath}: ${message}`);
        } else {
          messages.push(message);
        }
      }
    }

    if (error.children && error.children.length > 0) {
      for (const child of error.children) {
        traverse(child, propertyPath);
      }
    }
  };

  for (const error of validationErrors) {
    traverse(error);
  }

  return messages.length > 0
    ? Array.from(new Set(messages))
    : ['Payload validation failed.'];
};
