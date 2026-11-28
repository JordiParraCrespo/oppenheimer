/** A Claude Code cloud session's id, as the Oppenheimer API accepts it. */
export const cloudSessionIdPattern = /^session_[A-Za-z0-9]{8,64}$/;

/**
 * A session's id as the extension keeps it: claude.ai's list answers `cse_…`
 * (the id Claude Code knows the session by), its pages and the Oppenheimer API
 * say `session_…` with the same suffix. Read once, where the list is read.
 */
export function canonicalCloudId(id: string): string {
  return id.replace(/^cse_/, 'session_');
}

/** The id claude.ai's code-session routes take: `cse_…`. */
export function codeSessionId(id: string): string {
  return id.replace(/^session_/, 'cse_');
}
