import type { SessionEntity, SessionGroup } from '@oppenheimer/frontend-consumer';

/**
 * How a session's **group** reads as a dot. The sidebar shows the group
 * because it is organised by what needs you, not what a process is doing
 * (`product/versions/mvp/05-screens.md`). A session the host has not built yet
 * is `idle` by group, but the artboard draws it with a pulsing grey glyph:
 * that is the **lifecycle**, and {@link dotFor} combines the two.
 */
const DOT: Record<SessionGroup, 'running' | 'idle' | 'failed' | 'pending' | 'completed'> = {
  working: 'running',
  'waiting-on-you': 'failed',
  'ready-for-review': 'running',
  landing: 'pending',
  idle: 'idle',
  resolved: 'completed',
};

export function dotFor(session: SessionEntity) {
  return session.isProvisioning ? 'pending' : DOT[session.state];
}
