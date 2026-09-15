import type { ErrorDefinition } from '@oppenheimer/backend-ddd';

/**
 * Billing domain error catalog. Surfaced as HTTP responses by the global
 * `AllExceptionsFilter` via `AppError`.
 */
export const BillingErrors = {
  NOT_CONFIGURED: {
    code: 'BILLING_001',
    message: 'Billing is not configured on this server',
    httpStatus: 503,
  },
  CUSTOMER_NOT_FOUND: {
    code: 'BILLING_002',
    message: 'No billing customer exists for this user',
    httpStatus: 404,
  },
  SUBSCRIPTION_NOT_FOUND: {
    code: 'BILLING_003',
    message: 'No subscription found',
    httpStatus: 404,
  },
  WEBHOOK_SIGNATURE_INVALID: {
    code: 'BILLING_004',
    message: 'Invalid Stripe webhook signature',
    httpStatus: 400,
  },
  CHECKOUT_FAILED: {
    code: 'BILLING_005',
    message: 'Failed to create a Stripe Checkout session',
    httpStatus: 502,
  },
  ALREADY_SUBSCRIBED: {
    code: 'BILLING_006',
    message: 'This user already has an active subscription',
    httpStatus: 409,
  },
  PORTAL_FAILED: {
    code: 'BILLING_007',
    message: 'Failed to open the Stripe Customer Portal',
    httpStatus: 502,
  },
  CUSTOMER_CREATION_FAILED: {
    code: 'BILLING_008',
    message: 'Failed to create a Stripe customer',
    httpStatus: 502,
  },
} as const satisfies Record<string, ErrorDefinition>;
