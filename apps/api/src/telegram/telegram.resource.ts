import { defineResource } from '@oppenheimer/backend-authz';

/**
 * Telegram is the bots a person made with @BotFather and connected on their
 * hosts, read and written by their Oppenheimer bots
 * (`product/next-steps/telegram.md`). The rows sit in a workspace like
 * WhatsApp's, and every read of one adds its owner, so nobody reads another
 * person's chats, a workspace admin included.
 */
export const TelegramResource = defineResource({
  subject: 'Telegram',
  label: 'Telegram',
  group: 'control-plane',

  actions: [
    { name: 'read', label: 'View your connected Telegram bots' },
    { name: 'create', label: 'Connect a Telegram bot' },
    { name: 'update', label: 'Connect a Telegram bot again' },
    { name: 'delete', label: 'Disconnect a Telegram bot' },
  ],

  keys: {
    organization: 'organizationId',
    id: 'id',
  },

  scopes: ['organization'],
  credentialScope: 'telegram',
});
