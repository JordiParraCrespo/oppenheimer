import { defineResource } from '@oppenheimer/backend-authz';

/**
 * Projects are workspace-owned, and that is the whole of their scoping.
 *
 * No `team`, `own` or `grant` dimension: a project is a body of work the
 * workspace shares, and every member of the workspace sees all of them. The
 * tenant clause `applyAccessScope` writes from `keys.organization` is therefore
 * the only predicate, and — because no narrowing dimension is declared — the
 * query is not narrowed further. Adding a dimension later means adding a column,
 * which is the point of declaring the mapping here rather than in each query.
 *
 * Three actions. A person creates projects (`POST /projects`); a session that
 * names none lands in the workspace's Unassigned project, and nothing derives a
 * project from a repository. Archiving is `update`, because nothing is deleted:
 * the row outlives the project so its slug is never reissued.
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
