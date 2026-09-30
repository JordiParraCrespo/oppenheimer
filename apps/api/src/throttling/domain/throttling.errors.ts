import type { ErrorDefinition } from '@oppenheimer/backend-ddd';

/**
 * The limiter is global, so any route can answer with this: a coded 429
 * clients can branch on, where Nest's own `ThrottlerException` has no `code`.
 */
export const ThrottlingErrors = {
  TOO_MANY_REQUESTS: {
    code: 'RATE_001',
    message: 'Too many requests',
    httpStatus: 429,
  },
} as const satisfies Record<string, ErrorDefinition>;
