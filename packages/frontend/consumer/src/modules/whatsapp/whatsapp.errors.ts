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
  UPDATE_FAILED: {
    code: 'WHATSAPP_CLIENT_004',
    message: 'Failed to choose the bot that answers on WhatsApp',
  },
  OWNER_REQUEST_FAILED: {
    code: 'WHATSAPP_CLIENT_005',
    message: 'Failed to send a code to your number',
  },
  OWNER_CONFIRM_FAILED: {
    code: 'WHATSAPP_CLIENT_006',
    message: 'Failed to confirm your number',
  },
} as const satisfies Record<string, ErrorDefinition>;
