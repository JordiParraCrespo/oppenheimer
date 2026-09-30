import { defineResource } from '@oppenheimer/backend-authz';

/**
 * Sessions are workspace-owned, and that is the whole of their scoping.
 *
 * `organizationId` is the tenant boundary for the work, because the *host* is not
 * workspace-owned: a machine belongs to the person who paired it and workspaces
 * borrow it, so "whose session is this" is answered here, never by the host row.
 *
 * Four actions and no fifth. **Opening a terminal is `update Session`**: an `attach`
 * verb living only in the token picker would be a second, unofficial vocabulary, and
 * what keeps a read-only credential from a PTY is the scope split (`sessions:write`),
 * not a CASL action.
 *
 * The children declare nothing: `session_checkout` and `work_session_event` are only
 * read through their session, and resources of their own would add tenant predicates
 * for rows with no independent lifetime.
 */
export const SessionResource = defineResource({
  subject: 'Session',
  label: 'Sessions',
  group: 'control-plane',

  actions: [
    { name: 'read', label: 'View sessions' },
    { name: 'create', label: 'Start sessions' },
    { name: 'update', label: 'Rename, stop, restart and open a terminal on sessions' },
    { name: 'delete', label: 'Close sessions' },
  ],

  keys: {
    organization: 'organizationId',
    id: 'id',
  },

  scopes: ['organization'],
  credentialScope: 'sessions',
});
