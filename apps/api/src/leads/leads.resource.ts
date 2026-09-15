import { defineResource } from '@oppenheimer/backend-authz';

/**
 * The reference resource declaration.
 *
 * This is the entire authorization surface of the leads module: from these
 * fifteen lines the kernel derives the CASL conditions, the SQL predicate, the
 * role-builder entry and the credential scope. Nothing in the handlers,
 * repository or controllers below writes an authorization check by hand.
 */
export const LeadResource = defineResource({
  subject: 'Lead',
  label: 'Leads',
  group: 'crm',

  actions: [
    { name: 'read', label: 'View leads' },
    { name: 'create', label: 'Create leads' },
    { name: 'update', label: 'Edit leads' },
    { name: 'delete', label: 'Delete leads' },
    { name: 'export', label: 'Export to CSV', sensitive: true },
  ],

  /** Offered as field-level grants, e.g. a rep who may not see deal value. */
  fields: ['value', 'notes'],

  /** The columns each scope dimension filters on. */
  keys: {
    organization: 'organizationId',
    team: 'teamId',
    owner: 'ownerId',
    id: 'id',
  },

  scopes: ['organization', 'team', 'own', 'grant'],
  credentialScope: 'leads',
});
