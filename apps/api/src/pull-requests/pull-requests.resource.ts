import { defineResource } from '@oppenheimer/backend-authz';

/**
 * The Pull requests area. A pull request has no row — it is GitHub's, read
 * through the workspace's installations — so the subject guards the routes and
 * the one thing stored here, a person's watched repositories, which every read
 * of narrows to their own.
 */
export const PullRequestResource = defineResource({
  subject: 'PullRequest',
  label: 'Pull requests',
  group: 'control-plane',

  actions: [
    { name: 'read', label: 'View the queue, pull requests and analytics' },
    { name: 'update', label: 'Comment, review and merge, and choose watched repositories' },
  ],

  keys: {
    organization: 'organizationId',
    id: 'id',
  },

  scopes: ['organization'],
  credentialScope: 'pulls',
});
