import type { ErrorDefinition } from '@oppenheimer/frontend-core';

export const WhatsappErrors = {
  FETCH_ACCOUNTS_FAILED: {
    code: 'WHATSAPP_CLIENT_001',
    message: 'Failed to load your WhatsApp numbers',
  },
  LINK_FAILED: {
    code: 'WHATSAPP_CLIENT_002',
    message: 'Failed to link the WhatsApp number',
  },
  UNLINK_FAILED: {
    code: 'WHATSAPP_CLIENT_003',
    message: 'Failed to unlink the WhatsApp number',
  },
} as const satisfies Record<string, ErrorDefinition>;
