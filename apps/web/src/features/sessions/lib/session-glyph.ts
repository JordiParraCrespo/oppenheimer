import type { SessionEntity } from '@oppenheimer/frontend-consumer';

/**
 * The mark a session's sidebar row leads with
 * (`product/versions/mvp/24-session-places.md` §5): a terminal for the blank
 * terminal wherever it runs, a folder for a folder session, a cloud for one in
 * Claude Code's cloud, the vendor's mark for one launched at its vendor
 * (`SessionsConsole.dc.html`), and the branch for a worktree, which is what
 * the row has always drawn.
 */
export type SessionGlyph = 'terminal' | 'folder' | 'cloud' | 'vendor' | 'branch';

export function sessionGlyph(
  session: Pick<SessionEntity, 'agent' | 'place' | 'cloud'>,
): SessionGlyph {
  if (session.cloud) return 'vendor';
  if (session.agent === 'shell') return 'terminal';
  if (session.place === 'folder') return 'folder';
  return session.place === 'cloud' ? 'cloud' : 'branch';
}
