import type { SessionEntity, SessionGroup } from '@oppenheimer/frontend-consumer';

type SessionDot = 'running' | 'idle' | 'failed' | 'pending' | 'completed';

/**
 * How a session's **group** reads as a dot. The sidebar shows the group
 * because it is organised by what needs you, not what a process is doing
 * (`product/versions/mvp/05-screens.md`). A session the host has not built yet
 * is `idle` by group, but the artboard draws it with a pulsing grey glyph:
 * that is the **lifecycle**, and {@link dotFor} combines the two. A delete its
 * host has not carried out pulses the same way, and one its host refused is
 * red: both say so in the row's status word, since the row is not what it was.
 */
const DOT: Record<SessionGroup, SessionDot> = {
  working: 'running',
  'waiting-on-you': 'failed',
  'ready-for-review': 'running',
  landing: 'pending',
  idle: 'idle',
  resolved: 'completed',
};

export function dotFor(session: SessionEntity): SessionDot {
  if (session.closeRefusal) return 'failed';
  return session.isProvisioning || session.isClosing ? 'pending' : DOT[session.state];
}

/**
 * The word beside the dot in a session's header ("Running", the frame's
 * `paneState`), under `sessions.session.state`. The lifecycle speaks first —
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
