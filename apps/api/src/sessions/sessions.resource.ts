import { defineResource } from '@oppenheimer/backend-authz';

/**
 * Sessions are workspace-owned, and that is the whole of their scoping.
 *
 * `organizationId` is the tenant boundary for the work itself, which matters
 * because the *host* is not workspace-owned: a machine belongs to the person who
 * paired it and workspaces borrow it, so "whose session is this" is answered here
 * and never by the host row.
 *
 * Four actions and no fifth. **Opening a terminal is `update Session`** — there is
 * no `attach` verb, because a verb that lives only in the token picker is a second,
 * unofficial vocabulary; what keeps a read-only credential from getting a PTY is
 * the scope split (`sessions:write`), not a CASL action of its own. The CASL model
 * stays CRUD plus `manage`.
 *
 * The children declare nothing. `session_checkout` and `work_session_event` are
 * only ever read through their session, so giving them resources of their own would
 * put a second and a third tenant predicate in the system for rows that have no
 * independent lifetime.
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

  /** The columns each scope dimension filters on. */
  keys: {
    organization: 'organizationId',
    id: 'id',
  },

  scopes: ['organization'],
  credentialScope: 'sessions',
});
