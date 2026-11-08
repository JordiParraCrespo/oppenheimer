/**
 * What asking a cloud session's host to send it a reply came back with: the
 * CLI took it, the reason nothing was asked (no link, or a runner too old to
 * send one), no answer in time (it may have reached the session), or the
 * runner's refusal with its catalog code (`SESS_019` the host is not signed in
 * to claude.ai, `SESS_020` the CLI did not take it).
 */
export type SessionCloudPromptOutcome =
  | { kind: 'sent' }
  | { kind: 'host_offline' }
  | { kind: 'not_supported' }
  | { kind: 'timed_out' }
  | { kind: 'failed'; code: string; detail?: string };

/**
 * What the module that owns the runner link implements so a reply typed in a
 * Claude Code cloud session's chat can wake the session when its Stop hook is
 * no longer waiting: the host that started it runs `claude -p <text> --cloud
 * <id>` (`product/next-steps/cloud-agents.md`, "The chat of a cloud
 * session"). It waits for the runner's answer.
 */
export interface SessionCloudPromptPort {
  send(
    hostId: string,
    sessionId: string,
    cloudSessionId: string,
    text: string,
  ): Promise<SessionCloudPromptOutcome>;
}
