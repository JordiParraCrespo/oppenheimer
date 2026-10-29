import type { ErrorDefinition } from '@oppenheimer/backend-ddd';

export const MailErrors = {
  /** No such Gmail account of the caller's, or Google revoked it: Connect again. */
  GMAIL_NOT_CONNECTED: {
    code: 'MAIL_001',
    message: 'That Gmail account is not connected',
    httpStatus: 409,
  },
  NO_ACTIVE_ORGANIZATION: {
    code: 'MAIL_002',
    message: 'Mail belongs to an organization',
    httpStatus: 400,
  },
  /** The person already holds the five accounts mail takes; remove one first. */
  GMAIL_ACCOUNT_LIMIT_REACHED: {
    code: 'MAIL_003',
    message: 'That is as many Gmail accounts as mail takes',
    httpStatus: 409,
  },
  /** No Google client or no sealing key on this server. */
  GMAIL_NOT_CONFIGURED: {
    code: 'MAIL_004',
    message: 'Gmail is not configured on this server',
    httpStatus: 503,
  },
  /** The connect state was missing, expired, used, or someone else's. */
  GMAIL_STATE_REJECTED: {
    code: 'MAIL_005',
    message: 'That Gmail connection was not started here',
    httpStatus: 400,
  },
  /**
   * Google refused the code, gave no refresh token or ID token, or the person
   * left the Gmail permission unticked.
   */
  GMAIL_GRANT_REFUSED: {
    code: 'MAIL_006',
    message: 'Google did not grant access to Gmail',
    httpStatus: 400,
  },
  /** Gmail answered with an error, or did not answer. */
  GMAIL_UNAVAILABLE: {
    code: 'MAIL_007',
    message: 'Gmail did not answer',
    httpStatus: 502,
  },
  /**
   * Gmail's quota stopped the call, or an earlier answer already said to wait.
   * A 429 with `Retry-After`; Gmail is not asked again until then.
   */
  GMAIL_RATE_LIMITED: {
    code: 'MAIL_008',
    message: "Gmail's rate limit was reached; try again shortly",
    httpStatus: 429,
  },
  /** A message, thread, draft or attachment Gmail does not have (or no longer has). */
  GMAIL_ITEM_NOT_FOUND: {
    code: 'MAIL_009',
    message: 'Gmail has no such message',
    httpStatus: 404,
  },
  /** More recipients than a bot sends to at once, none at all, or an address that is not one. */
  RECIPIENTS_REFUSED: {
    code: 'MAIL_010',
    message: 'That message cannot go to those recipients',
    httpStatus: 400,
  },
  /** The account has sent its day's share of bot mail. */
  DAILY_LIMIT_REACHED: {
    code: 'MAIL_011',
    message: 'That account has sent as much bot mail as a day allows',
    httpStatus: 429,
  },
  /** The message with its files is past Gmail's 25 MB. */
  MESSAGE_TOO_LARGE: {
    code: 'MAIL_012',
    message: 'That message is larger than Gmail takes',
    httpStatus: 400,
  },
  /** A `from` that is not the account or one of its Gmail send-as aliases. */
  ALIAS_NOT_FOUND: {
    code: 'MAIL_013',
    message: 'That address is not one this account sends from',
    httpStatus: 400,
  },
  /** The draft was edited, sent or deleted after the card that approved sending it. */
  DRAFT_CHANGED: {
    code: 'MAIL_014',
    message: 'That draft changed since it was approved',
    httpStatus: 409,
  },
  /**
   * An earlier attempt at this approved send was started and never confirmed:
   * it may have gone. Never sent again on its own.
   */
  SEND_UNCONFIRMED: {
    code: 'MAIL_015',
    message: 'That message may already have been sent',
    httpStatus: 409,
  },
} as const satisfies Record<string, ErrorDefinition>;
