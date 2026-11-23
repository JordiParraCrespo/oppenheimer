import { defineResource } from '@oppenheimer/backend-authz';

/**
 * Slack is the apps a person connected for their bots, each answering in
 * Slack as its bot. The rows sit in a workspace like Telegram's, and every
 * read of one adds its owner, so nobody reads another person's app.
 */
export const SlackResource = defineResource({
  subject: 'Slack',
  label: 'Slack',
  group: 'control-plane',

  actions: [
    { name: 'read', label: 'View your bots’ Slack apps' },
    { name: 'create', label: 'Connect a bot’s Slack app' },
    { name: 'update', label: 'Link your Slack user to a bot’s app' },
    { name: 'delete', label: 'Disconnect a bot’s Slack app' },
  ],

  keys: {
    organization: 'organizationId',
    id: 'id',
  },

  scopes: ['organization'],
  credentialScope: 'slack',
});
