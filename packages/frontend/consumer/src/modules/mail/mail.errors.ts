import type { ErrorDefinition } from '@oppenheimer/frontend-core';

export const MailErrors = {
  FETCH_CONNECTIONS_FAILED: {
    code: 'MAIL_CLIENT_001',
    message: 'Failed to load your Gmail accounts',
  },
  CONNECT_FAILED: {
    code: 'MAIL_CLIENT_002',
    message: 'Failed to connect Gmail',
  },
  RENAME_FAILED: {
    code: 'MAIL_CLIENT_003',
    message: 'Failed to rename the Gmail account',
  },
  DISCONNECT_FAILED: {
    code: 'MAIL_CLIENT_004',
    message: 'Failed to disconnect the Gmail account',
  },
} as const satisfies Record<string, ErrorDefinition>;
