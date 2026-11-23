import type { ErrorDefinition } from '@oppenheimer/backend-ddd';

export const SlackErrors = {
  /** No connected Slack app with that id among the caller's own. */
  ACCOUNT_NOT_FOUND: {
    code: 'SLACK_001',
    message: 'That Slack app is not connected',
    httpStatus: 404,
  },
  NO_ACTIVE_ORGANIZATION: {
    code: 'SLACK_002',
    message: 'Slack belongs to an organization',
    httpStatus: 400,
  },
  /** No `SLACK_TOKEN_KEY` on this server, so no Slack token can be kept. */
  NOT_CONFIGURED: {
    code: 'SLACK_003',
    message: 'Slack is not configured on this server',
    httpStatus: 503,
  },
  /** Slack refused the bot token: wrong, revoked, or the app is not installed. */
  TOKEN_REFUSED: {
    code: 'SLACK_004',
    message: 'Slack refused the bot token',
    httpStatus: 422,
  },
  /** The same Slack app already answers as another bot: one app is one bot. */
  APP_TAKEN: {
    code: 'SLACK_005',
    message: 'That Slack app already answers as another bot',
    httpStatus: 409,
  },
  /** Slack answered with an error, or did not answer. */
  UNAVAILABLE: {
    code: 'SLACK_006',
    message: 'Slack did not answer',
    httpStatus: 502,
  },
  /** Slack's rate limit for the app's workspace, or calls queued past what this server waits for. */
  RATE_LIMITED: {
    code: 'SLACK_007',
    message: 'Slack’s rate limit was reached',
    httpStatus: 429,
  },
  /** An event whose signature is missing, wrong or too old: not Slack's, or replayed. */
  SIGNATURE_INVALID: {
    code: 'SLACK_008',
    message: 'The Slack event’s signature does not match',
    httpStatus: 401,
  },
} as const satisfies Record<string, ErrorDefinition>;
