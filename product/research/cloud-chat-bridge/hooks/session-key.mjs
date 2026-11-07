/**
 * The session id both hooks send, as Claude Code hands it over: in a cloud
 * session the one claude.ai knows it by (`CLAUDE_CODE_REMOTE_SESSION_ID`,
 * `cse_…`), elsewhere Claude Code's own (`session_id` on the hook's stdin).
 * The server maps it to the console's id; the hooks know no prefixes.
 */
export function sessionKey(input, env = process.env) {
  return env.CLAUDE_CODE_REMOTE_SESSION_ID || input.session_id;
}
