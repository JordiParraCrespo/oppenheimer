/**
 * What sending a reply to a Claude Code cloud session from a host came back
 * with: Claude Code took it (`sent`); it may have, but did not say so in time
 * (`unconfirmed`), which is never sent again; or it certainly did not, so the
 * reply can go back to the Stop hook: no host of the list holds a link that
 * takes `cloud.reply` (`no_host`), or the host's Claude Code refused, with the
 * runner's catalog code (`refused`).
 */
export type CloudSessionReplyOutcome =
  | { kind: 'sent'; hostId: string }
  | { kind: 'unconfirmed'; hostId: string; code?: string }
  | { kind: 'no_host' }
  | { kind: 'refused'; hostId: string; code: string; detail?: string };

/**
 * What the module that owns the runner link implements so a reply typed in a
 * cloud session's chat can wake the session (`product/next-steps/cloud-agents.md`,
 * "The chat of a cloud session", decision 2): `cloud.reply` to one host, the
 * host's own `claude -p … --cloud <id>` on its claude.ai sign-in, which the
 * control plane never holds.
 */
export interface CloudSessionReplyPort {
  /**
   * Sends `text` to `cloudSessionId` through the first of `hostIds` that is
   * online and whose runner named `session.cloud.reply`, and waits for its
   * answer. Only one host is ever asked.
   */
  send(
    hostIds: readonly string[],
    cloudSessionId: string,
    text: string,
  ): Promise<CloudSessionReplyOutcome>;
}
