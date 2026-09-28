import type { z } from 'zod';
import { AppError, fieldErrorsFromZod } from './errors.js';

/** Parses a request body/query/params with a zod schema, or throws COMMON_001 with field errors. */
export function parseWith<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new AppError('COMMON_001', undefined, fieldErrorsFromZod(result.error));
  }
  return result.data;
}
