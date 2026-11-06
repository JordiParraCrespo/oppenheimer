/**
 * The id Oppenheimer knows a session by: claude.ai's in a cloud session
 * (`CLAUDE_CODE_REMOTE_SESSION_ID` is `cse_…`, claude.ai shows `session_…`
 * with the same suffix), else Claude Code's own session id.
 */
export function sessionKey(input, env = process.env) {
  const remote = env.CLAUDE_CODE_REMOTE_SESSION_ID;
  if (remote) return remote.replace(/^cse_/, 'session_');
  return input.session_id;
}
