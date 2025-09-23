import { BadRequestException } from '@nestjs/common';

export class ValidationException extends BadRequestException {
  constructor(errors: string[]) {
    super({
      code: 'VALIDATION_ERROR',
      message: 'Payload validation failed',
      details: errors,
    });
  }
}

export class Validator {
  static ensureObject(
    payload: unknown,
    errors: string[],
  ): Record<string, unknown> {
    if (!payload || typeof payload !== 'object') {
      errors.push('Payload must be a JSON object.');
      return {};
    }
    return payload as Record<string, unknown>;
  }

  static requiredString(
    source: Record<string, unknown>,
    field: string,
    errors: string[],
    options?: {
      minLength?: number;
      maxLength?: number;
      pattern?: RegExp;
      format?: 'email' | 'iso-date' | 'uuid';
    },
  ): string {
    const value = source[field];
    if (typeof value !== 'string' || value.trim().length === 0) {
      errors.push(`${field} is required and must be a non-empty string.`);
      return '';
    }
    return this.validateString(value, field, errors, options);
  }

  static optionalString(
    source: Record<string, unknown>,
    field: string,
    errors: string[],
    options?: {
      minLength?: number;
      maxLength?: number;
      pattern?: RegExp;
      format?: 'email' | 'iso-date' | 'uuid';
    },
  ): string | undefined {
    const value = source[field];
    if (value === undefined || value === null) {
      return undefined;
    }
    if (typeof value !== 'string') {
      errors.push(`${field} must be a string when provided.`);
      return undefined;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      errors.push(`${field} cannot be empty when provided.`);
      return undefined;
    }
    return this.validateString(trimmed, field, errors, options);
  }

  private static validateString(
    value: string,
    field: string,
    errors: string[],
    options?: {
      minLength?: number;
      maxLength?: number;
      pattern?: RegExp;
      format?: 'email' | 'iso-date' | 'uuid';
    },
  ): string {
    if (!options) {
      return value;
    }
    if (options.minLength && value.length < options.minLength) {
      errors.push(`${field} must be at least ${options.minLength} characters.`);
    }
    if (options.maxLength && value.length > options.maxLength) {
      errors.push(`${field} must be at most ${options.maxLength} characters.`);
    }
    if (options.pattern && !options.pattern.test(value)) {
      errors.push(`${field} has an invalid format.`);
    }
    if (
      options.format === 'email' &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
    ) {
      errors.push(`${field} must be a valid email address.`);
    }
    if (options.format === 'iso-date' && Number.isNaN(Date.parse(value))) {
      errors.push(`${field} must be a valid ISO 8601 date.`);
    }
    if (
      options.format === 'uuid' &&
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        value,
      )
    ) {
      errors.push(`${field} must be a valid UUID.`);
    }
    return value;
  }

  static optionalStringArray(
    source: Record<string, unknown>,
    field: string,
    errors: string[],
  ): string[] | undefined {
    const value = source[field];
    if (value === undefined || value === null) {
      return undefined;
    }
    if (!Array.isArray(value)) {
      errors.push(`${field} must be an array of strings when provided.`);
      return undefined;
    }
    const invalid = value.filter(
      (item) => typeof item !== 'string' || item.trim().length === 0,
    );
    if (invalid.length > 0) {
      errors.push(`${field} must only include non-empty strings.`);
      return undefined;
    }
    return value.map((item: string) => item.trim());
  }

  static optionalNumber(
    source: Record<string, unknown>,
    field: string,
    errors: string[],
    options?: { min?: number; max?: number; integer?: boolean },
  ): number | undefined {
    const value = source[field];
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    const numeric = Number(value);
    if (Number.isNaN(numeric)) {
      errors.push(`${field} must be a numeric value.`);
      return undefined;
    }
    if (options?.integer && !Number.isInteger(numeric)) {
      errors.push(`${field} must be an integer.`);
    }
    if (options?.min !== undefined && numeric < options.min) {
      errors.push(`${field} must be greater than or equal to ${options.min}.`);
    }
    if (options?.max !== undefined && numeric > options.max) {
      errors.push(`${field} must be less than or equal to ${options.max}.`);
    }
    return numeric;
  }

  static optionalBoolean(
    source: Record<string, unknown>,
    field: string,
    errors: string[],
  ): boolean | undefined {
    const value = source[field];
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    if (typeof value === 'boolean') {
      return value;
    }
    if (value === 'true') {
      return true;
    }
    if (value === 'false') {
      return false;
    }
    errors.push(`${field} must be a boolean value.`);
    return undefined;
  }

  static requiredDate(
    source: Record<string, unknown>,
    field: string,
    errors: string[],
  ): Date {
    const value = this.requiredString(source, field, errors, {
      format: 'iso-date',
    });
    if (!value) {
      return new Date(0);
    }
    return new Date(value);
  }

  static optionalDate(
    source: Record<string, unknown>,
    field: string,
    errors: string[],
  ): Date | undefined {
    const value = this.optionalString(source, field, errors, {
      format: 'iso-date',
    });
    if (!value) {
      return undefined;
    }
    return new Date(value);
  }
}
