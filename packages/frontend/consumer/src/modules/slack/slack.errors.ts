import type { ErrorDefinition } from '@oppenheimer/frontend-core';

export const SlackErrors = {
  FETCH_FAILED: {
    code: 'SLACK_CLIENT_001',
    message: 'Failed to load the bot’s Slack app',
  },
  CONNECT_FAILED: {
    code: 'SLACK_CLIENT_002',
    message: 'Failed to connect the Slack app',
  },
  DISCONNECT_FAILED: {
    code: 'SLACK_CLIENT_003',
    message: 'Failed to disconnect the Slack app',
  },
  OWNER_LINK_FAILED: {
    code: 'SLACK_CLIENT_004',
    message: 'Failed to make the code that records you as the owner',
  },
} as const satisfies Record<string, ErrorDefinition>;
