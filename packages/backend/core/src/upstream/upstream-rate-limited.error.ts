import { AppError, type ErrorDefinition } from '../errors/app.error';

/**
 * The problem an integration answers when a provider's rate limit stops a
 * call: its own catalog code (a `429`), the provider named, and
 * `retryAfterSeconds`, which `AllExceptionsFilter` also sends as `Retry-After`
 * so a client can wait instead of retrying into the same wall.
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
    extensions: {
      upstream: options.system,
      retryAfterSeconds,
      resetAt: options.resetAt.toISOString(),
    },
  });
}
