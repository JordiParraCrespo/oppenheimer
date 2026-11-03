/**
 * What asking a session's host for the preview of a file its agent shared came
 * back with: the JPEG, base64; the reason nothing was asked (no link, or a
 * runner too old to answer); no answer in time; or the runner's refusal with
 * its catalog code (`SESS_001` the session is not on that host, `SESS_016` no
 * such file, `SESS_017` it has no preview).
 */
export type SessionSharedPreviewOutcome =
  | { kind: 'preview'; mediaType: 'image/jpeg'; data: string }
  | { kind: 'host_offline' }
  | { kind: 'not_supported' }
  | { kind: 'timed_out' }
  | { kind: 'failed'; code: string; detail?: string };

/**
 * What the module that owns the runner link implements so a bot can show a
 * file an agent shared (`product/next-steps/agent-tools.md` §7). The bytes
 * live on the host; like `SessionPortsPort` it waits for the runner's answer,
 * and nothing is cached.
 */
export interface SessionSharedFilesPort {
  preview(hostId: string, sessionId: string, fileId: string): Promise<SessionSharedPreviewOutcome>;
}
