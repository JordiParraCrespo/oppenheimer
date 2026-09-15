import { QueryFailedError } from 'typeorm';

/** Postgres SQLSTATE for a `unique_violation`. */
const UNIQUE_VIOLATION = '23505';

/**
 * Whether an error is a Postgres unique-constraint violation. Lets callers treat
 * a lost check-then-insert race (a row inserted concurrently between the lookup
 * and the insert) as an idempotent no-op instead of an unhandled 500.
 */
export function isUniqueViolation(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) return false;
  const driverError = (error as QueryFailedError & { driverError?: { code?: string } }).driverError;
  return driverError?.code === UNIQUE_VIOLATION;
}
