import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { CodexEnvironmentsListMessage } from '@oppenheimer/shared/protocol';
import type {
  HostCodexEnvironmentsOutcome,
  HostCodexEnvironmentsPort,
} from '../../sessions/application/host-codex-environments.port';
import type { LinkRegistryPort } from '../application/link-registry.port';
import type { LinkRepliesPort } from '../application/link-replies.port';
import { LINK_REGISTRY, LINK_REPLIES } from '../links.di-tokens';

/**
 * How long a list may take. The runner makes up to two requests to ChatGPT,
 * or runs `codex cloud list` when it cannot: slower than a directory listing,
 * and still short enough that the picker says the host did not answer rather
 * than spin.
 */
export const CODEX_ENVIRONMENTS_TIMEOUT_MS = 25_000;

/**
 * `HostCodexEnvironmentsPort` over the runner link: `codex.environments.list`
 * with a fresh `commandId`, then the `codex.environments` or `command.failed`
 * that names it, through `LinkRepliesPort`. Sent only to a runner whose hello
 * named `codex.environments`; an older one would never answer.
 */
@Injectable()
export class RelayHostCodexEnvironmentsAdapter implements HostCodexEnvironmentsPort {
  constructor(
    @Inject(LINK_REGISTRY)
    private readonly links: LinkRegistryPort,
    @Inject(LINK_REPLIES)
    private readonly replies: LinkRepliesPort,
  ) {}

  async list(hostId: string, repository?: string): Promise<HostCodexEnvironmentsOutcome> {
    const link = this.links.find(hostId);
    if (!link) return { kind: 'host_offline' };
    if (!link.capabilities.includes('codex.environments')) return { kind: 'not_supported' };

    const message: CodexEnvironmentsListMessage = {
      type: 'codex.environments.list',
      commandId: randomUUID(),
      ...(repository ? { repository } : {}),
    };
    // Waiting before sending, so an answer faster than this line cannot be missed.
    const pending = this.replies.expect(hostId, message.commandId, CODEX_ENVIRONMENTS_TIMEOUT_MS);
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
    if (reply.type !== 'codex.environments') return { kind: 'failed', code: 'UNEXPECTED_REPLY' };
    const { type: _type, commandId: _commandId, ...listing } = reply;
    return { kind: 'listed', listing };
  }
}
