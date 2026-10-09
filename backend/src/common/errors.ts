import type { FastifyError, FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { isSpaNavigation, sendSpaIndex } from './spa.js';

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
  AUTH_005: { status: 401, message: 'Passkey not accepted' },
  AUTH_006: { status: 403, message: 'Wrong password' },
  AUTH_007: { status: 409, message: 'Passkey limit reached' },
  AUTH_008: { status: 400, message: 'Passkey registration failed' },
  AUTH_009: { status: 404, message: 'Passkey not found' },
  // LIBRARY
  LIBRARY_001: { status: 500, message: 'Workflow library folder not found (WORKFLOW_PATH/library)' },
  LIBRARY_002: { status: 400, message: 'Uploaded file is not a valid skill manifest' },
  LIBRARY_003: { status: 409, message: 'A skill with this name already exists in this stack' },
  LIBRARY_004: { status: 404, message: 'Stack not found in the library' },
  LIBRARY_005: { status: 400, message: 'Missing, empty or oversized file' },
  // TERMINAL
  TERMINAL_001: { status: 404, message: 'Terminal not found' },
  TERMINAL_002: { status: 409, message: 'MAX_TERMINALS reached' },
  TERMINAL_003: { status: 409, message: 'Session already open in another terminal' },
  TERMINAL_004: { status: 404, message: 'Saved session not found' },
  TERMINAL_005: { status: 503, message: 'claude binary not found (CLAUDE_BIN)' },
  TERMINAL_006: { status: 409, message: 'Terminal is already running' },
  // FOLDER
  FOLDER_001: { status: 403, message: 'Folder does not exist or is outside ALLOWED_ROOTS' },
  // SESSION
  SESSION_001: { status: 404, message: 'No saved session in this folder' },
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

export type ErrorHandlerOptions = {
  /** Browser navigations outside /api get the SPA's index.html instead of a JSON 404. */
  spaFallback?: boolean;
};

/** The single error handler of the app — every error response goes through here. */
export function registerErrorHandler(app: FastifyInstance, { spaFallback = false }: ErrorHandlerOptions = {}): void {
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
    if (spaFallback && isSpaNavigation(request)) return sendSpaIndex(reply);
    const appError = new AppError('COMMON_003', `Route not found: ${request.method}`);
    return reply.status(appError.status).send(toErrorResponse(appError));
  });
}
