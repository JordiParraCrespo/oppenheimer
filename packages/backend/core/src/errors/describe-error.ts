/**
 * The one-line description of a caught value, for a log line or a problem
 * `detail`: an `Error`'s message, or anything else as a string.
 *
 * `catch` binds `unknown`, and every best-effort path that logs and carries on
 * needs this same narrowing; one copy means one answer for a thrown string, a
 * rejected `undefined` or a plain object.
 */
export function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
