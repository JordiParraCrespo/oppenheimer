import { defineResource } from '@oppenheimer/backend-authz';

/**
 * Automations are workspace-owned, like sessions: every member sees them all,
 * and the tenant clause is the only predicate. Their runs are read under the
 * same resource — a run is an automation's history, not a thing of its own.
 */
export const AutomationResource = defineResource({
  subject: 'Automation',
  label: 'Automations',
  group: 'control-plane',

  actions: [
    { name: 'read', label: 'View automations, their runs and history' },
    { name: 'create', label: 'Create automations' },
    { name: 'update', label: 'Edit, pause, resume, duplicate and run automations' },
    { name: 'delete', label: 'Delete automations' },
  ],

  keys: {
    organization: 'organizationId',
    id: 'id',
  },

  scopes: ['organization'],
  credentialScope: 'automations',
});
