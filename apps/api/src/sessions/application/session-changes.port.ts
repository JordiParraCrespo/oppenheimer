import type { SessionChangesMessage, SessionChangesScope } from '@oppenheimer/shared/protocol';

/** One checkout's changes, as its runner read them. */
export type SessionCheckoutChangesListing = SessionChangesMessage['checkouts'][number];

/**
 * What asking a session's host for its changes came back with: each
 * checkout's changed files, the reason nothing was asked (no link, or a
 * runner that does not read changes), no answer in time, or the runner's
 * refusal with its catalog code (`SESS_001` no such session on the host).
 */
export type SessionChangesOutcome =
  | { kind: 'listed'; checkouts: SessionCheckoutChangesListing[] }
  | { kind: 'host_offline' }
  | { kind: 'not_supported' }
  | { kind: 'timed_out' }
  | { kind: 'failed'; code: string; detail?: string };

/**
 * What the module that owns the runner link implements so the console's
 * Review can read what a session's checkouts changed: git run on the host
 * now, over the link. Nothing is stored.
 */
export interface SessionChangesPort {
  read(
    hostId: string,
    sessionId: string,
    scope: SessionChangesScope,
  ): Promise<SessionChangesOutcome>;
}
