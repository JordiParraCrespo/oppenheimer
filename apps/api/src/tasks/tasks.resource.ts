import { defineResource } from '@oppenheimer/backend-authz';

/**
 * Plan's board is workspace-owned: every member sees every task and milestone, so the
 * tenant clause is the only predicate. Milestones and the links from a task to its
 * sessions are read under the same subject; a milestone is a way of grouping tasks,
 * not a thing with access of its own.
 */
export const TaskResource = defineResource({
  subject: 'Task',
  label: 'Tasks',
  group: 'control-plane',

  actions: [
    { name: 'read', label: 'View the board, its tasks and milestones' },
    { name: 'create', label: 'Create tasks and milestones' },
    { name: 'update', label: 'Edit and move tasks and milestones, and attach sessions' },
    { name: 'delete', label: 'Delete tasks and milestones' },
  ],

  keys: {
    organization: 'organizationId',
    id: 'id',
  },

  scopes: ['organization'],
  credentialScope: 'tasks',
});
