import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  Type,
  mixin,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Observable } from 'rxjs';

import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import type { Request } from 'express';

export function OptionalFileInterceptor(
  fieldName: string,
  localOptions?: MulterOptions,
): Type<NestInterceptor> {
  @Injectable()
  class MixinInterceptor implements NestInterceptor {
    private readonly delegate = new (FileInterceptor(
      fieldName,
      localOptions,
    ))();

    intercept(
      context: ExecutionContext,
      next: CallHandler,
    ): Observable<any> | Promise<Observable<any>> {
      const request = context.switchToHttp().getRequest<Request>();
      const contentType = request.headers['content-type'];
      const isMultipart =
        (typeof contentType === 'string' &&
          contentType.includes('multipart/form-data')) ||
        (typeof request.is === 'function' && request.is('multipart/form-data'));

      if (isMultipart) {
        return this.delegate.intercept(context, next);
      }

      return next.handle();
    }
  }

  return mixin(MixinInterceptor);
}
