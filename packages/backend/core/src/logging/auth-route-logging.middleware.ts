import { pinoHttp } from 'pino-http';
import { buildPinoHttpOptions, type LoggingOptions } from './pino-http-options';

export type AuthRouteLoggingMiddleware = (
  req: unknown,
  res: unknown,
  next: (error?: unknown) => void,
) => void;

/**
 * Request logger for the Better Auth routes, meant for the `middleware` option
 * of `@thallesp/nestjs-better-auth`'s `AuthModule.forRoot`.
 *
 * It exists because Better Auth mounts its handler directly onto the HTTP
 * adapter while modules are being configured — before Nest binds anything
 * registered through `MiddlewareConsumer` — and the handler never calls
 * `next()` for its own routes. The `nestjs-pino` request logger therefore
 * sits behind it in the middleware stack and never sees `/api/auth/*`,
 * whatever the import order. Wrapping the handler through the `middleware`
 * option is the only path those requests all cross.
 *
 * Uses the same hardened options as the main request logger, so sign-in
 * bodies, session cookies, and OAuth callback query strings stay out of the
 * log lines these routes produce.
 */
export function createAuthRouteLoggingMiddleware(
  options: LoggingOptions = {},
): AuthRouteLoggingMiddleware {
  const middleware = pinoHttp(buildPinoHttpOptions(options));
  return (req, res, next) =>
    middleware(
      req as Parameters<typeof middleware>[0],
      res as Parameters<typeof middleware>[1],
      () => next(),
    );
}
