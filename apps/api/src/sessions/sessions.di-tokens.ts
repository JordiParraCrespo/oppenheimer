/**
 * `SESSION_DISPATCH` is what `links/` binds to send a session's work to a host;
 * this module imports that binding rather than providing one. The other direction
 * is the published surface `relay/` calls: `RECORD_SESSION_EVENTS` with a runner's
 * batch, `SESSION_LOOKUP` to redeem an attach ticket or a credential ask, and
 * `SESSION_RECONCILIATION` with a runner's hello. `SESSION_USAGE_READER` is the
 * weekly turn usage other modules read (Plan's Stats), bound to a
 * `SessionUsageReader`.
 */
export const WORK_SESSION_REPOSITORY = Symbol('WORK_SESSION_REPOSITORY');
export const SESSION_DISPATCH = Symbol('SESSION_DISPATCH');
/** The folder picker's listing of a host's directories; bound by `links/` like `SESSION_DISPATCH`. */
export const HOST_FOLDERS = Symbol('HOST_FOLDERS');
/** The Browser tab's listing of a session's ports; bound by `links/` like `HOST_FOLDERS`. */
export const SESSION_PORTS = Symbol('SESSION_PORTS');
/** A shared file's preview, asked of the session's host; bound by `links/` like `SESSION_PORTS`. */
export const SESSION_SHARED_FILES = Symbol('SESSION_SHARED_FILES');
/** A page of a session's conversation, asked of the session's host; bound by `links/` like `SESSION_SHARED_FILES`. */
export const SESSION_TRANSCRIPT = Symbol('SESSION_TRANSCRIPT');
/** The composer's listing of a host's Codex cloud environments; bound by `links/` like `HOST_FOLDERS`. */
export const HOST_CODEX_ENVIRONMENTS = Symbol('HOST_CODEX_ENVIRONMENTS');
/** A reply sent to a Claude Code cloud session from a host (`cloud.reply`); bound by `links/` like `HOST_CODEX_ENVIRONMENTS`. */
export const CLOUD_SESSION_REPLY = Symbol('CLOUD_SESSION_REPLY');
/** A bot's command run on a host by its runner (`host.exec`); bound by `links/` like `HOST_FOLDERS`. */
export const HOST_EXEC = Symbol('HOST_EXEC');
export const HOST_COMPUTER = Symbol('HOST_COMPUTER');
export const HOST_BROWSER = Symbol('HOST_BROWSER');
/** A bot typing into a blank terminal and reading it back (`terminal.drive`); bound by `links/`. */
export const SESSION_TERMINAL = Symbol('SESSION_TERMINAL');
export const RECORD_SESSION_EVENTS = Symbol('RECORD_SESSION_EVENTS');
export const SESSION_LOOKUP = Symbol('SESSION_LOOKUP');
export const SESSION_RECONCILIATION = Symbol('SESSION_RECONCILIATION');
export const SESSION_SHARE_REPOSITORY = Symbol('SESSION_SHARE_REPOSITORY');
export const SESSION_USAGE_READER = Symbol('SESSION_USAGE_READER');
/** Where a cloud session's first-task files are kept and linked from (`CloudFilesPort`). */
export const CLOUD_FILES = Symbol('CLOUD_FILES');
/** A session's terminal watches (`session_terminal_watch`). */
export const SESSION_TERMINAL_WATCH_REPOSITORY = Symbol('SESSION_TERMINAL_WATCH_REPOSITORY');
/** Where a wake for a session's own agent waits for its time (`SessionWakesPort`). */
export const SESSION_WAKES = Symbol('SESSION_WAKES');
/** A Claude Code cloud session's transcript lines and waiting replies (`session_cloud_line`, `session_cloud_reply`). */
export const SESSION_CLOUD_CHAT_REPOSITORY = Symbol('SESSION_CLOUD_CHAT_REPOSITORY');
