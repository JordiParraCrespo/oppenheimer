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
 * Three actions. A person creates projects (`POST /projects`), and the API also
 * creates one for a repository when a session names no project
 * (`product/versions/mvp/10-api-modules-and-data-model.md`). Archiving is `update`, because nothing
 * is deleted: the row outlives the project so its slug is never reissued.
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

  /** The columns each scope dimension filters on. */
  keys: {
    organization: 'organizationId',
    id: 'id',
  },

  scopes: ['organization'],
  credentialScope: 'projects',
});
