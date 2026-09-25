import type { ErrorDefinition } from '@oppenheimer/backend-ddd';

/**
 * Feature-flag error catalog. Surfaced as RFC 7807 problem documents by the
 * global `AllExceptionsFilter` via `AppError`.
 */
export const FeatureFlagErrors = {
  /** The key is not in the code's catalog — the database cannot invent a flag. */
  UNKNOWN_FLAG: {
    code: 'FLAG_001',
    message: 'Feature flag not found',
    httpStatus: 404,
  },
  INVALID_TARGETING: {
    code: 'FLAG_002',
    message: 'The targeting is not valid for this flag',
    httpStatus: 422,
  },
  /**
   * An endpoint behind `@RequireFlag` was called while its flag is off for the
   * caller. A client that hides the entry point on the same flag never sees it.
   */
  FEATURE_DISABLED: {
    code: 'FLAG_003',
    message: 'This feature is not available',
    httpStatus: 403,
  },
  SEGMENT_NOT_FOUND: {
    code: 'FLAG_004',
    message: 'Segment not found',
    httpStatus: 404,
  },
  SEGMENT_KEY_TAKEN: {
    code: 'FLAG_005',
    message: 'A segment with this key already exists',
    httpStatus: 409,
  },
  /** Deleting a segment a rule still targets would silently shrink that rule's audience. */
  SEGMENT_IN_USE: {
    code: 'FLAG_006',
    message: 'The segment is still targeted by a flag',
    httpStatus: 409,
  },
  INVALID_SEGMENT: {
    code: 'FLAG_007',
    message: 'The segment conditions are not valid',
    httpStatus: 422,
  },
} as const satisfies Record<string, ErrorDefinition>;
