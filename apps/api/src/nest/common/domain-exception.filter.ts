import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException } from '@nestjs/common';

interface ResponseLike {
  status(code: number): ResponseLike;
  json(body: unknown): void;
}

/**
 * Domain errors are plain classes without HTTP knowledge (several contexts define
 * their own `WorkoutNotFoundError`), so they are mapped by `name` here.
 */
const STATUS_BY_ERROR_NAME: Record<string, number> = {
  WorkoutNotFoundError: 404,
  WorkoutOwnershipError: 403,
  WorkoutAccessDeniedError: 403,
  NoEntriesError: 400,
  LogSetValidationError: 400,
  InvalidRoutineDayError: 400,
  EmailAlreadyRegisteredError: 409,
  InvalidCredentialsError: 401,
  PhotoSizeExceededError: 413,
  UnsupportedPhotoFormatError: 415,
  CaptionTooLongError: 400,
  EmptyPhotoBytesError: 400,
  PhotoNotFoundError: 404,
  DisplayNameRequiredError: 400,
  DisplayNameTooLongError: 400,
  InvalidRoutineTypeError: 400,
  InvalidWeightUnitError: 400,
};

const ERROR_LABEL: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  413: 'Payload Too Large',
  415: 'Unsupported Media Type',
  429: 'Too Many Requests',
  503: 'Service Unavailable',
  500: 'Internal Server Error',
};

/** Every non-2xx response has the `ApiError` shape from `@gym-up/contracts`. */
@Catch()
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<ResponseLike>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const message =
        typeof body === 'string'
          ? body
          : typeof (body as { message?: unknown }).message === 'string'
            ? (body as { message: string }).message
            : exception.message;
      res.status(status).json({ statusCode: status, message, error: ERROR_LABEL[status] });
      return;
    }

    const name = exception instanceof Error ? exception.name : '';
    const status = STATUS_BY_ERROR_NAME[name];
    if (status && exception instanceof Error) {
      res.status(status).json({ statusCode: status, message: exception.message, error: ERROR_LABEL[status] });
      return;
    }

    // Errors raised by Express middleware (for example body-parser's 413) carry their own HTTP status.
    const middlewareStatus = (exception as { status?: unknown } | null)?.status;
    if (typeof middlewareStatus === 'number' && middlewareStatus >= 400 && middlewareStatus < 500) {
      res.status(middlewareStatus).json({
        statusCode: middlewareStatus,
        message: exception instanceof Error ? exception.message : 'Bad request',
        error: ERROR_LABEL[middlewareStatus],
      });
      return;
    }

    console.error('Unhandled error', exception);
    res.status(500).json({ statusCode: 500, message: 'Internal server error', error: ERROR_LABEL[500] });
  }
}
