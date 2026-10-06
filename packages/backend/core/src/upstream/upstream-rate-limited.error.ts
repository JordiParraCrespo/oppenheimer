import { AppError, type ErrorDefinition } from '../errors/app.error';

/**
 * The problem an integration answers when a provider's rate limit stops a
 * call: its own catalog code (a `429`), the provider named, and how long to
 * wait, as `AppError.retryAfterSeconds` (which `AllExceptionsFilter` sends as
 * `Retry-After`) and in the body for clients that read it there.
 */
export function upstreamRateLimited(
  error: ErrorDefinition,
  options: { system: string; resetAt: Date; detail?: string; now?: number },
): AppError {
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((options.resetAt.getTime() - (options.now ?? Date.now())) / 1000),
  );
  return new AppError(error, {
    detail:
      options.detail ??
      `${options.system} asked us to slow down; try again in ${retryAfterSeconds} seconds.`,
    retryAfterSeconds,
    extensions: {
      upstream: options.system,
      retryAfterSeconds,
      resetAt: options.resetAt.toISOString(),
    },
  });
}
