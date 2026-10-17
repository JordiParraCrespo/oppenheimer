import type { SessionEntity } from '@oppenheimer/frontend-consumer';

/**
 * The mark a session's sidebar row leads with
 * (`product/versions/mvp/24-session-places.md` §5): a terminal for the blank
 * terminal wherever it runs, a folder for a folder session, and the branch for
 * a worktree, which is what the row has always drawn.
 */
export type SessionGlyph = 'terminal' | 'folder' | 'branch';

export function sessionGlyph(session: Pick<SessionEntity, 'agent' | 'place'>): SessionGlyph {
  if (session.agent === 'shell') return 'terminal';
  return session.place === 'folder' ? 'folder' : 'branch';
}
