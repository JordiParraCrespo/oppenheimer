import { defineResource } from '@oppenheimer/backend-authz';

/**
 * Mail is a person's own Gmail accounts, worked by their bots
 * (`product/next-steps/mail.md`). The rows sit in a workspace like the
 * calendar's, and every read of one adds its owner, so nobody reaches
 * another person's mailbox, a workspace admin included.
 */
export const MailResource = defineResource({
  subject: 'Mail',
  label: 'Mail',
  group: 'control-plane',

  actions: [
    { name: 'read', label: 'View your connected Gmail accounts' },
    { name: 'create', label: 'Connect Gmail' },
    { name: 'update', label: 'Rename a Gmail account' },
    { name: 'delete', label: 'Disconnect Gmail' },
  ],

  keys: {
    organization: 'organizationId',
    id: 'id',
  },

  scopes: ['organization'],
  credentialScope: 'mail',
});
