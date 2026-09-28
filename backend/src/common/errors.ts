import type { FastifyError, FastifyInstance } from 'fastify';
import { ZodError } from 'zod';

/**
 * Every error the API can return. The frontend mirrors these 1:1 in
 * `frontend/src/errors/errorMessages.ts` — change both in the same commit.
 */
export const ErrorCode = {
  // COMMON
  COMMON_001: { status: 400, message: 'Validation failed' },
  COMMON_002: { status: 500, message: 'Internal error' },
  COMMON_003: { status: 404, message: 'Route not found' },
  // AUTH
  AUTH_001: { status: 401, message: 'Invalid credentials' },
  AUTH_002: { status: 401, message: 'Not authenticated' },
  AUTH_003: { status: 403, message: 'Origin not allowed' },
  AUTH_004: { status: 429, message: 'Too many login attempts' },
} as const satisfies Record<string, { status: number; message: string }>;

export type ErrorCode = keyof typeof ErrorCode;

export type FieldError = { field: string; message: string };

export type ErrorResponse = {
  errorCode: ErrorCode;
  message: string;
  fieldErrors?: FieldError[];
};

export class AppError extends Error {
  readonly status: number;

  constructor(
    readonly code: ErrorCode,
    message?: string,
    readonly fieldErrors?: FieldError[],
  ) {
    super(message ?? ErrorCode[code].message);
    this.name = 'AppError';
    this.status = ErrorCode[code].status;
  }
}

export function fieldErrorsFromZod(error: ZodError): FieldError[] {
  return error.issues.map((issue) => ({
    field: issue.path.length > 0 ? issue.path.join('.') : '(root)',
    message: issue.message,
  }));
}

export function toErrorResponse(error: AppError): ErrorResponse {
  return {
    errorCode: error.code,
    message: error.message,
    ...(error.fieldErrors && error.fieldErrors.length > 0 ? { fieldErrors: error.fieldErrors } : {}),
  };
}

function normalize(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof ZodError) return new AppError('COMMON_001', undefined, fieldErrorsFromZod(error));

  const fastifyError = error as Partial<FastifyError>;
  // Fastify's own client errors (malformed JSON, wrong content type, body too large…).
  if (fastifyError.statusCode && fastifyError.statusCode >= 400 && fastifyError.statusCode < 500) {
    return new AppError('COMMON_001', fastifyError.code ?? 'Bad request');
  }
  return new AppError('COMMON_002');
}

/** The single error handler of the app — every error response goes through here. */
export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    const appError = normalize(error);
    if (appError.status >= 500) {
      request.log.error({ err: error }, 'unhandled error');
    } else {
      request.log.info({ errorCode: appError.code }, appError.message);
    }
    return reply.status(appError.status).send(toErrorResponse(appError));
  });

  app.setNotFoundHandler((request, reply) => {
    const appError = new AppError('COMMON_003', `Route not found: ${request.method}`);
    return reply.status(appError.status).send(toErrorResponse(appError));
  });
}
