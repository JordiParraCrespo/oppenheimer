import { defineResource } from '@oppenheimer/backend-authz';

/**
 * Projects are workspace-owned, and that is the whole of their scoping.
 *
 * No `team`, `own` or `grant` dimension: a project is a body of work the
 * workspace shares, and every member of the workspace sees all of them. The
 * tenant clause `applyAccessScope` writes from `keys.organization` is therefore
 * the only predicate, and — because no narrowing dimension is declared — the
 * query is not narrowed further. Adding a dimension later means adding a
 * column, which is the point of declaring the mapping here rather than in each
 * query.
 */
export const ProjectResource = defineResource({
  subject: 'Project',
  label: 'Projects',
  group: 'control-plane',

  actions: [
    { name: 'read', label: 'View projects' },
    // Nothing creates a project over HTTP: the first session for a repository
    // creates it. The action exists because roles are composed from these
    // entries, and a workspace owner holding `manage Project` must not be
    // described as holding less than it does.
    { name: 'create', label: 'Create projects' },
    { name: 'update', label: 'Rename projects' },
    { name: 'delete', label: 'Archive projects' },
  ],

  /** The columns each scope dimension filters on. */
  keys: {
    organization: 'organizationId',
    id: 'id',
  },

  scopes: ['organization'],
  credentialScope: 'projects',
});
