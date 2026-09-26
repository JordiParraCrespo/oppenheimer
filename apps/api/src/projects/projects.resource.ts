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
 * Two actions, and only two: a project is created by the first session that
 * needs one, through a port inside the process, so no route and no credential
 * exercises a `create` — declaring one would put a permission in every role
 * builder and token scope that nobody can use. `delete` arrives with archiving,
 * in the slice that can answer whether a project still has work in it.
 */
export const ProjectResource = defineResource({
  subject: 'Project',
  label: 'Projects',
  group: 'control-plane',

  actions: [
    { name: 'read', label: 'View projects' },
    { name: 'create', label: 'Create projects' },
    { name: 'update', label: 'Edit and archive projects' },
  ],

  /** The columns each scope dimension filters on. */
  keys: {
    organization: 'organizationId',
    id: 'id',
  },

  scopes: ['organization'],
  credentialScope: 'projects',
});
