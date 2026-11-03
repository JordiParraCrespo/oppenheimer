import type { ErrorDefinition } from '@oppenheimer/backend-ddd';

export const SentryErrors = {
  /** No `SENTRY_CONNECTION_KEY` on this server, so no client secret can be kept. */
  NOT_CONFIGURED: {
    code: 'SENTRY_001',
    message: 'Sentry triggers are not configured on this server',
    httpStatus: 503,
  },
  /** The workspace has not connected a Sentry organization, or not this one. */
  NOT_CONNECTED: {
    code: 'SENTRY_002',
    message: 'No Sentry organization is connected to this workspace',
    httpStatus: 404,
  },
  /** A webhook whose signature is not the connection's client secret's. */
  WEBHOOK_SIGNATURE_INVALID: {
    code: 'SENTRY_003',
    message: 'The Sentry webhook signature is invalid',
    httpStatus: 401,
  },
} as const satisfies Record<string, ErrorDefinition>;
