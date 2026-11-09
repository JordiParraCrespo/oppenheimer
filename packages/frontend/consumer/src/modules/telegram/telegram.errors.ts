import type { ErrorDefinition } from '@oppenheimer/frontend-core';

export const TelegramErrors = {
  FETCH_ACCOUNTS_FAILED: {
    code: 'TELEGRAM_CLIENT_001',
    message: 'Failed to load your Telegram bots',
  },
  LINK_FAILED: {
    code: 'TELEGRAM_CLIENT_002',
    message: 'Failed to connect the Telegram bot',
  },
  UNLINK_FAILED: {
    code: 'TELEGRAM_CLIENT_003',
    message: 'Failed to disconnect the Telegram bot',
  },
  UPDATE_FAILED: {
    code: 'TELEGRAM_CLIENT_004',
    message: 'Failed to choose the bot that answers on Telegram',
  },
  OWNER_LINK_FAILED: {
    code: 'TELEGRAM_CLIENT_005',
    message: 'Failed to make the link that records you as the owner',
  },
} as const satisfies Record<string, ErrorDefinition>;
