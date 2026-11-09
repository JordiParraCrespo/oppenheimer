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
} as const satisfies Record<string, ErrorDefinition>;
