import { defineResource } from '../authz/domain/resource-definition.types';

/**
 * Bots are workspace-owned, like automations: every member sees them all, and
 * the tenant clause is the only predicate. Groups, documents and memory are
 * read under the same subject; they are parts of a bot, not things with access
 * of their own.
 */
export const BotResource = defineResource({
  subject: 'Bot',
  label: 'Bots',
  group: 'control-plane',

  actions: [
    { name: 'read', label: 'View bots, their groups, documents and memory' },
    { name: 'create', label: 'Create bots and groups' },
    {
      name: 'update',
      label: 'Edit bots and groups, their soul and instructions, and what they remember',
    },
    { name: 'delete', label: 'Delete bots and groups' },
  ],

  keys: {
    organization: 'organizationId',
    id: 'id',
  },

  scopes: ['organization'],
  credentialScope: 'bots',
});
