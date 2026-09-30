import { defineResource } from '@oppenheimer/backend-authz';

/**
 * Projects are workspace-owned, and that is the whole of their scoping: no `team`,
 * `own` or `grant` dimension, because every member sees every project, so the tenant
 * clause `applyAccessScope` writes from `keys.organization` is the only predicate.
 * Adding a dimension later means adding a column here, not in each query.
 *
 * A person creates projects (`POST /projects`); a session that names none lands in the
 * workspace's Unassigned project, and nothing derives a project from a repository.
 * Archiving is `update`: the row outlives the project so its slug is never reissued.
 */
export const ProjectResource = defineResource({
  subject: 'Project',
  label: 'Projects',
  group: 'control-plane',

  actions: [
    { name: 'read', label: 'View projects' },
    { name: 'create', label: 'Create projects' },
    { name: 'update', label: 'Change and archive projects' },
  ],

  keys: {
    organization: 'organizationId',
    id: 'id',
  },

  scopes: ['organization'],
  credentialScope: 'projects',
});
