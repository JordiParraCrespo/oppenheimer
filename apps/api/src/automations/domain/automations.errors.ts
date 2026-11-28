import type { ErrorDefinition } from '@oppenheimer/backend-ddd';

export const AutomationErrors = {
  /** Also raised for an automation in another workspace, or one that was deleted. */
  NOT_FOUND: {
    code: 'AUTOMATIONS_001',
    message: 'Automation not found',
    httpStatus: 404,
  },
  /** Somebody saved the automation since this editor loaded it. */
  VERSION_CONFLICT: {
    code: 'AUTOMATIONS_003',
    message: 'The automation was changed by someone else',
    httpStatus: 409,
  },
  /** A repository the workspace's installations do not reach, or the same one twice. */
  REPOSITORY_UNAVAILABLE: {
    code: 'AUTOMATIONS_004',
    message: 'A repository is not available to this workspace',
    httpStatus: 422,
  },
  /** The agent has no unattended mode, or no approvals to set a level on. */
  AGENT_UNSUPPORTED: {
    code: 'AUTOMATIONS_005',
    message: 'That agent cannot run an automation',
    httpStatus: 422,
  },
  /** A `once` trigger in the past, or a rule that never fires. */
  TRIGGER_NEVER_FIRES: {
    code: 'AUTOMATIONS_006',
    message: 'A trigger would never fire',
    httpStatus: 422,
  },
  /** An automation is set up for a project; the workspace's Unassigned project holds none. */
  PROJECT_UNAVAILABLE: {
    code: 'AUTOMATIONS_007',
    message: 'That project cannot hold automations',
    httpStatus: 422,
  },
  RUN_NOT_FOUND: {
    code: 'AUTOMATIONS_008',
    message: 'Run not found',
    httpStatus: 404,
  },
  /** A mail trigger on a Gmail account that is not the owner's, or no longer connected. */
  MAIL_ACCOUNT_UNAVAILABLE: {
    code: 'AUTOMATIONS_009',
    message: 'That Gmail account cannot start a routine',
    httpStatus: 422,
  },
  /** No routine's webhook has this URL: never issued, rotated, revoked, or its trigger removed. */
  WEBHOOK_NOT_FOUND: {
    code: 'AUTOMATIONS_010',
    message: 'Webhook not found',
    httpStatus: 404,
  },
  /** A signed webhook's request with no signature, a stale one, one that does not match, or one already received. */
  WEBHOOK_SIGNATURE_INVALID: {
    code: 'AUTOMATIONS_011',
    message: 'The webhook signature is missing, stale or wrong',
    httpStatus: 401,
  },
  /** A body over `WEBHOOK_BODY_MAX_BYTES`. */
  WEBHOOK_BODY_TOO_LARGE: {
    code: 'AUTOMATIONS_012',
    message: 'The webhook body is too large',
    httpStatus: 413,
  },
  /** The routine is paused: nothing posted to it runs until it is turned back on. */
  WEBHOOK_ROUTINE_PAUSED: {
    code: 'AUTOMATIONS_013',
    message: 'The routine is paused',
    httpStatus: 409,
  },
  /** A URL asked for a routine that has no webhook trigger. */
  WEBHOOK_TRIGGER_MISSING: {
    code: 'AUTOMATIONS_014',
    message: 'The routine has no webhook trigger',
    httpStatus: 422,
  },
  /** A signing secret asked for while `BOTS_PROVIDER_KEY` is unset, so it could not be kept. */
  WEBHOOK_SIGNING_UNAVAILABLE: {
    code: 'AUTOMATIONS_015',
    message: 'Webhook signing is not configured on this deployment',
    httpStatus: 503,
  },
} as const satisfies Record<string, ErrorDefinition>;
