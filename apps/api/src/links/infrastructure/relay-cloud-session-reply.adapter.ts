import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { CloudReplyMessage } from '@oppenheimer/shared/protocol';
import type {
  CloudSessionReplyOutcome,
  CloudSessionReplyPort,
} from '../../sessions/application/cloud-session-reply.port';
import type { LinkRegistryPort } from '../application/link-registry.port';
import type { LinkRepliesPort } from '../application/link-replies.port';
import { LINK_REGISTRY, LINK_REPLIES } from '../links.di-tokens';

/**
 * How long a send may take. The runner gives `claude -p … --cloud` 45 s and
 * then answers `SESS_021`; this is past that, so its own answer comes first.
 */
export const CLOUD_REPLY_TIMEOUT_MS = 60_000;

/** The runner's code for a send Claude Code may have made but did not confirm. */
const UNCONFIRMED = 'SESS_021';

/**
 * `CloudSessionReplyPort` over the runner link: `cloud.reply` with a fresh
 * `commandId`, then the `cloud.replied` or `command.failed` that names it,
 * through `LinkRepliesPort`. Sent only to a runner whose hello named
 * `session.cloud.reply`; an older one would never answer.
 */
@Injectable()
export class RelayCloudSessionReplyAdapter implements CloudSessionReplyPort {
  constructor(
    @Inject(LINK_REGISTRY)
    private readonly links: LinkRegistryPort,
    @Inject(LINK_REPLIES)
    private readonly replies: LinkRepliesPort,
  ) {}

  async send(
    hostIds: readonly string[],
    cloudSessionId: string,
    text: string,
  ): Promise<CloudSessionReplyOutcome> {
    const link = hostIds
      .map((hostId) => this.links.find(hostId))
      .find((found) => found?.capabilities.includes('session.cloud.reply'));
    if (!link) return { kind: 'no_host' };

    const message: CloudReplyMessage = {
      type: 'cloud.reply',
      commandId: randomUUID(),
      cloudSessionId,
      text,
    };
    const { hostId } = link;
    // Waiting before sending, so an answer faster than this line cannot be missed.
    const pending = this.replies.expect(hostId, message.commandId, CLOUD_REPLY_TIMEOUT_MS);
    if (!link.send(message)) {
      pending.cancel();
      return { kind: 'no_host' };
    }
    const reply = await pending.reply;
    if (!reply) return { kind: 'unconfirmed', hostId };
    if (reply.type === 'cloud.replied') return { kind: 'sent', hostId };
    if (reply.type === 'command.failed') {
      return reply.code === UNCONFIRMED
        ? { kind: 'unconfirmed', hostId, code: reply.code }
        : { kind: 'refused', hostId, code: reply.code, detail: reply.detail };
    }
    // A reply is matched by command id, so another kind is a runner bug, and
    // nothing says the message did not go.
    return { kind: 'unconfirmed', hostId, code: 'UNEXPECTED_REPLY' };
  }
}
