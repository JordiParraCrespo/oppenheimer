import type { ErrorDefinition } from '@oppenheimer/backend-ddd';

export const InboundEventErrors = {
  /** A delivery names a source no build of this API registered an adapter for. */
  UNKNOWN_SOURCE: {
    code: 'INBOUND_001',
    message: 'That event source is not known',
    httpStatus: 400,
  },
  /** A delivery arrived without the provider's delivery id, which is its idempotency key. */
  DELIVERY_ID_MISSING: {
    code: 'INBOUND_002',
    message: 'The delivery carries no delivery id',
    httpStatus: 400,
  },
} as const satisfies Record<string, ErrorDefinition>;
