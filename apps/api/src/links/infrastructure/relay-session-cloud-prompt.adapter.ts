import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { SessionCloudPromptMessage } from '@oppenheimer/shared/protocol';
import type {
  SessionCloudPromptOutcome,
  SessionCloudPromptPort,
} from '../../sessions/application/session-cloud-prompt.port';
import type { LinkRegistryPort } from '../application/link-registry.port';
import type { LinkRepliesPort } from '../application/link-replies.port';
import { LINK_REGISTRY, LINK_REPLIES } from '../links.di-tokens';

/**
 * How long a reply may take to send. The runner gives the CLI a minute, a
 * round trip to claude.ai; past this the caller is told the host did not
 * answer, which may still mean the session has the message.
 */
export const CLOUD_PROMPT_TIMEOUT_MS = 75_000;

/**
 * `SessionCloudPromptPort` over the runner link: `session.cloud.prompt` with
 * a fresh `commandId`, then the `session.cloud.prompted` or `command.failed`
 * that names it, through `LinkRepliesPort`. Sent only to a runner whose hello
 * named `session.cloud.prompt`; an older one would log the frame as unknown
 * and never answer.
 */
@Injectable()
export class RelaySessionCloudPromptAdapter implements SessionCloudPromptPort {
  constructor(
    @Inject(LINK_REGISTRY)
    private readonly links: LinkRegistryPort,
    @Inject(LINK_REPLIES)
    private readonly replies: LinkRepliesPort,
  ) {}

  async send(
    hostId: string,
    sessionId: string,
    cloudSessionId: string,
    text: string,
  ): Promise<SessionCloudPromptOutcome> {
    const link = this.links.find(hostId);
    if (!link) return { kind: 'host_offline' };
    if (!link.capabilities.includes('session.cloud.prompt')) return { kind: 'not_supported' };

    const message: SessionCloudPromptMessage = {
      type: 'session.cloud.prompt',
      commandId: randomUUID(),
      sessionId,
      cloudSessionId,
      text,
    };
    // Waiting before sending, so an answer faster than this line cannot be missed.
    const pending = this.replies.expect(hostId, message.commandId, CLOUD_PROMPT_TIMEOUT_MS);
    if (!link.send(message)) {
      pending.cancel();
      return { kind: 'host_offline' };
    }
    const reply = await pending.reply;
    if (!reply) return { kind: 'timed_out' };
    if (reply.type === 'command.failed') {
      return { kind: 'failed', code: reply.code, detail: reply.detail };
    }
    // A reply is matched by command id, so another kind is a runner bug.
    if (reply.type !== 'session.cloud.prompted')
      return { kind: 'failed', code: 'UNEXPECTED_REPLY' };
    return { kind: 'sent' };
  }
}
