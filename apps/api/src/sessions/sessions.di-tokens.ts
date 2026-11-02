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
/** The composer's listing of a host's Codex cloud environments; bound by `links/` like `HOST_FOLDERS`. */
export const HOST_CODEX_ENVIRONMENTS = Symbol('HOST_CODEX_ENVIRONMENTS');
export const RECORD_SESSION_EVENTS = Symbol('RECORD_SESSION_EVENTS');
export const SESSION_LOOKUP = Symbol('SESSION_LOOKUP');
export const SESSION_RECONCILIATION = Symbol('SESSION_RECONCILIATION');
export const SESSION_SHARE_REPOSITORY = Symbol('SESSION_SHARE_REPOSITORY');
export const SESSION_USAGE_READER = Symbol('SESSION_USAGE_READER');
/** Where a cloud session's first-task files are kept and linked from (`CloudFilesPort`). */
export const CLOUD_FILES = Symbol('CLOUD_FILES');
/** A session's terminal watches (`session_terminal_watch`). */
export const SESSION_TERMINAL_WATCH_REPOSITORY = Symbol('SESSION_TERMINAL_WATCH_REPOSITORY');
