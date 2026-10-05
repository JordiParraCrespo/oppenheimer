import { defineResource } from '@oppenheimer/backend-authz';

/**
 * Plan's board is workspace-owned: every member sees every task and goal, so the
 * tenant clause is the only predicate. Goals and the links from a task to its
 * sessions are read under the same subject; a goal is a way of grouping tasks,
 * not a thing with access of its own.
 */
export const TaskResource = defineResource({
  subject: 'Task',
  label: 'Tasks',
  group: 'control-plane',

  actions: [
    { name: 'read', label: 'View the board, its tasks and goals' },
    { name: 'create', label: 'Create tasks and goals' },
    { name: 'update', label: 'Edit and move tasks and goals, and attach sessions' },
    { name: 'delete', label: 'Delete tasks and goals' },
  ],

  keys: {
    organization: 'organizationId',
    id: 'id',
  },

  scopes: ['organization'],
  credentialScope: 'tasks',
});
