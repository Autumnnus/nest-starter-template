import { Injectable, ValidationPipe } from '@nestjs/common';

import {
  extractValidationMessages,
  ValidationException,
} from 'src/common/utils/validation.util';

@Injectable()
export class AppValidationPipe extends ValidationPipe {
  constructor() {
    super({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      validationError: {
        target: false,
        value: false,
      },
      exceptionFactory: (errors) =>
        new ValidationException(extractValidationMessages(errors)),
    });
  }
}
