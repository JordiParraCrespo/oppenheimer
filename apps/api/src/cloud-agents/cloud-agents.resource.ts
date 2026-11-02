import { defineResource } from '@oppenheimer/backend-authz';

/**
 * Cloud agents are workspace-owned like sessions, and also a person's: every
 * read adds its owner (the agent's creator, the key's holder), so nobody reads
 * another's agents or learns whether they connected a vendor.
 */
export const CloudAgentResource = defineResource({
  subject: 'CloudAgent',
  label: 'Cloud agent',
  group: 'control-plane',

  actions: [
    { name: 'read', label: 'View cloud agents' },
    { name: 'create', label: 'Launch cloud agents and connect a vendor' },
    { name: 'update', label: 'Follow up on and stop cloud agents' },
    { name: 'delete', label: 'Disconnect a vendor' },
  ],

  keys: {
    organization: 'organizationId',
    id: 'id',
  },

  scopes: ['organization'],
  credentialScope: 'cloud-agents',
});
