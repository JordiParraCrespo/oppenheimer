import { registerAs } from '@nestjs/config';
import { z } from 'zod';
import { parseEnv } from './env';

const positive = (fallback: number) => z.coerce.number().int().positive().default(fallback);

/**
 * The API's rate limits: the default every route gets, and the failed-credential
 * limit per address. Counters live in Redis, so each is the limit across all
 * replicas. A route with its own `@Throttle` keeps its own number beside it:
 * that number is part of what the route is.
 *
 * **Defaulted, all of it.**
 */
const schema = z.object({
  /** Requests one caller may make to a route in a window, unless the route says otherwise. */
  defaultLimit: positive(100),
  defaultWindowSeconds: positive(60),
  /** Failed credentials one address may present in a window before it is blocked. */
  authFailureLimit: positive(30),
  authFailureWindowSeconds: positive(60),
  /** How long a blocked address stays blocked. */
  authFailureBlockSeconds: positive(60),
});

export type ThrottlingConfig = z.infer<typeof schema>;

export const throttlingConfig = registerAs('throttling', () =>
  parseEnv('throttling', schema, {
    defaultLimit: 'RATE_LIMIT_DEFAULT_LIMIT',
    defaultWindowSeconds: 'RATE_LIMIT_DEFAULT_WINDOW_SECONDS',
    authFailureLimit: 'RATE_LIMIT_AUTH_FAILURES',
    authFailureWindowSeconds: 'RATE_LIMIT_AUTH_FAILURE_WINDOW_SECONDS',
    authFailureBlockSeconds: 'RATE_LIMIT_AUTH_FAILURE_BLOCK_SECONDS',
  }),
);
