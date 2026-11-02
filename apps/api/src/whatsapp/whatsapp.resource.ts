import { defineResource } from '@oppenheimer/backend-authz';

/**
 * WhatsApp is the numbers a person linked as devices on their hosts, read and
 * written by their bots (`product/next-steps/whatsapp.md`). The rows sit in a
 * workspace like mail's, and every read of one adds its owner, so nobody
 * reads another person's chats, a workspace admin included.
 */
export const WhatsappResource = defineResource({
  subject: 'Whatsapp',
  label: 'WhatsApp',
  group: 'control-plane',

  actions: [
    { name: 'read', label: 'View your linked WhatsApp numbers' },
    { name: 'create', label: 'Link a WhatsApp number' },
    { name: 'update', label: 'Pair a WhatsApp number again' },
    { name: 'delete', label: 'Unlink a WhatsApp number' },
  ],

  keys: {
    organization: 'organizationId',
    id: 'id',
  },

  scopes: ['organization'],
  credentialScope: 'whatsapp',
});
