import type { SessionEntity, SessionGroup } from './session.entity';

/**
 * The word a session reads as ("Running", "Needs input"), under
 * `sessions.session.state`: beside the dot in the console's session header,
 * and in a row's line on the phone. The lifecycle speaks first —
 * a session still starting, one that failed to, one stopped or deleted is
 * that, whatever its group — and a live one reads its group.
 */
export type SessionStateWord =
  | 'starting'
  | 'failed'
  | 'stopped'
  | 'deleted'
  | 'deleting'
  | SessionGroup;

export function stateWordFor(session: SessionEntity): SessionStateWord {
  if (session.isClosing) return 'deleting';
  if (session.isProvisioning) return 'starting';
  if (session.lifecycle === 'failed') return 'failed';
  if (session.isResolved) return 'deleted';
  if (!session.isLive) return 'stopped';
  return session.state;
}
