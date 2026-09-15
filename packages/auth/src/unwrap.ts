/**
 * What Better Auth puts in the `error` half of a client result: its own
 * `SCREAMING_SNAKE_CASE` code plus the HTTP status the request came back with
 * (`@better-fetch`'s `Error` type always carries `status`/`statusText`).
 */
export interface AuthErrorResult {
  message?: string;
  code?: string;
  status?: number;
  statusText?: string;
}

/**
 * A rejected Better Auth client call.
 *
 * Carrying `status` and `code` is what lets a caller tell an *application*
 * failure (a wrong password: the server answered 401) apart from a *transport*
 * failure (the request never arrived, so there is no status at all). Throwing a
 * bare `Error` collapses the two, and a UI that cannot tell them apart ends up
 * telling someone who mistyped their password to check their connection.
 */
export class AuthRequestError extends Error {
  readonly code?: string;
  /** HTTP status, when the server answered at all. */
  readonly status?: number;

  constructor(error: AuthErrorResult) {
    super(error.message ?? 'Authentication request failed');
    this.name = 'AuthRequestError';
    this.code = error.code;
    this.status = error.status;
  }
}

/**
 * Better Auth client methods resolve with `{ data, error }` instead of
 * rejecting. `unwrap` turns the error half into a thrown {@link AuthRequestError}
 * so the `IAuthClient` adapters can expose plain rejecting promises.
 */
export function unwrap(result: { error?: AuthErrorResult | null }): void {
  if (result.error) {
    throw new AuthRequestError(result.error);
  }
}
