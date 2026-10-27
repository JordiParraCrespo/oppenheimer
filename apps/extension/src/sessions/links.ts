export const CLAUDE_ORIGIN = 'https://claude.ai';

/** The session on claude.ai/code. */
export function sessionUrl(id: string) {
  return `${CLAUDE_ORIGIN}/code/${encodeURIComponent(id)}`;
}

/**
 * The command that brings the session into a terminal: its branch and its
 * conversation, from the repository's checkout (`claude --teleport`). The way
 * back out is `claude --cloud`.
 */
export function teleportCommand(id: string) {
  return `claude --teleport ${id}`;
}
