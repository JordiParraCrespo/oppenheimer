import type { ErrorDefinition } from '@oppenheimer/backend-ddd';

export const TelegramErrors = {
  /** No such connected Telegram bot of the caller's. */
  ACCOUNT_NOT_FOUND: {
    code: 'TELEGRAM_001',
    message: 'That Telegram bot is not connected',
    httpStatus: 404,
  },
  NO_ACTIVE_ORGANIZATION: {
    code: 'TELEGRAM_002',
    message: 'Telegram belongs to an organization',
    httpStatus: 400,
  },
  /** The person already connects as many Telegram bots as they may; disconnect one first. */
  ACCOUNT_LIMIT_REACHED: {
    code: 'TELEGRAM_003',
    message: 'That is as many Telegram bots as one person connects',
    httpStatus: 409,
  },
  /** The host's runner is not connected, so nothing can reach its bot. */
  HOST_OFFLINE: {
    code: 'TELEGRAM_004',
    message: 'The host holding that Telegram bot is offline',
    httpStatus: 409,
  },
  /** The host's runner predates Telegram, or was started with it switched off. */
  HOST_UNSUPPORTED: {
    code: 'TELEGRAM_005',
    message: 'That host’s runner does not hold Telegram bots',
    httpStatus: 409,
  },
  /** Another person's Telegram bot is on that host: a runner holds one. */
  HOST_TAKEN: {
    code: 'TELEGRAM_006',
    message: 'That host already holds another Telegram bot',
    httpStatus: 409,
  },
  /** The host is not polling the bot: connecting, its token revoked, or backing off. */
  NOT_CONNECTED: {
    code: 'TELEGRAM_007',
    message: 'That Telegram bot is not connected',
    httpStatus: 409,
  },
  /** Telegram, or the host's runner, refused the message or did not answer. */
  SEND_FAILED: {
    code: 'TELEGRAM_008',
    message: 'Telegram did not take the message',
    httpStatus: 502,
  },
  /** The Telegram bot has sent its day's share of bot messages. */
  SEND_LIMIT_REACHED: {
    code: 'TELEGRAM_009',
    message: 'That Telegram bot has sent as many bot messages as it may for now',
    httpStatus: 429,
  },
  /** No chat of that Telegram bot matches, or several do. */
  CHAT_NOT_FOUND: {
    code: 'TELEGRAM_010',
    message: 'No such Telegram chat',
    httpStatus: 404,
  },
} as const satisfies Record<string, ErrorDefinition>;
