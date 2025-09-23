import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import {
  ApiError,
  AuthenticatedUser,
} from 'src/auth/interfaces/authenticated-user.interface';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<ApiError>();
    const request = ctx.getRequest<AuthenticatedUser>();

    const traceId: string = request.traceId ?? 'unknown-trace';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let code = 'INTERNAL_SERVER_ERROR';
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null
      ) {
        const {
          code: responseCode,
          message: responseMessage,
          details: responseDetails,
        } = exceptionResponse as Record<string, unknown>;
        if (typeof responseMessage === 'string') {
          message = responseMessage;
        }

        if (typeof responseCode === 'string') {
          code = responseCode;
        } else {
          code = this.mapStatusToCode(status);
        }

        if (responseDetails !== undefined) {
          details = responseDetails;
        }
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    if (!code) {
      code = this.mapStatusToCode(status);
    }

    this.logger.error(
      `${code} ${message}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    response.status(status).json({
      error: {
        code,
        message,
        traceId,
        ...(details !== undefined ? { details } : {}),
      },
    });
  }

  private mapStatusToCode(status: HttpStatus): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'BAD_REQUEST';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'RESOURCE_NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'CONFLICT';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'RATE_LIMIT_EXCEEDED';
      default:
        return 'INTERNAL_SERVER_ERROR';
    }
  }
}
