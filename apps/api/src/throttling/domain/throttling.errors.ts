import type { ErrorDefinition } from '@oppenheimer/backend-ddd';

/**
 * Rate-limiter error catalog. The limiter is global, so any route can answer
 * with this; without a catalog entry a 429 went out as Nest's own
 * `ThrottlerException` with no `code`, and clients had nothing to branch on.
 */
export const ThrottlingErrors = {
  TOO_MANY_REQUESTS: {
    code: 'RATE_001',
    message: 'Too many requests',
    httpStatus: 429,
  },
} as const satisfies Record<string, ErrorDefinition>;
