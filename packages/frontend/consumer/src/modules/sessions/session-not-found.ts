import { AppError } from '@oppenheimer/frontend-core';

/**
 * Whether a failed session read means "no such session" rather than "ask
 * again later".
 *
 * The console's session route needs the difference: a 404 is a destination
 * that will never exist — a mistyped id, a closed session, someone else's link
 * — and the answer is the 404 pane with a way back. Anything else is a read
 * that failed, and the answer is a retry. `SessionsRepository.findById` is
 * what keeps the status on the error.
 */
export function isSessionNotFound(error: unknown): boolean {
  return error instanceof AppError && error.status === 404;
}
