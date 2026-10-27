import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { PortListMessage } from '@oppenheimer/shared/protocol';
import type {
  SessionPortsOutcome,
  SessionPortsPort,
} from '../../sessions/application/session-ports.port';
import type { LinkRegistryPort } from '../application/link-registry.port';
import type { LinkRepliesPort } from '../application/link-replies.port';
import { LINK_REGISTRY, LINK_REPLIES } from '../links.di-tokens';

/**
 * How long a listing may take. A runner reads its process table, which is a
 * moment even on a busy host; past this the tab says the host did not answer.
 */
export const PORT_LIST_TIMEOUT_MS = 5_000;

/**
 * `SessionPortsPort` over the runner link: `port.list` with a fresh
 * `commandId`, then the `port.listing` or `command.failed` that names it,
 * through `LinkRepliesPort`. Sent only to a runner whose hello named
 * `port.forward`.
 */
@Injectable()
export class RelaySessionPortsAdapter implements SessionPortsPort {
  constructor(
    @Inject(LINK_REGISTRY)
    private readonly links: LinkRegistryPort,
    @Inject(LINK_REPLIES)
    private readonly replies: LinkRepliesPort,
  ) {}

  async list(hostId: string, sessionId: string): Promise<SessionPortsOutcome> {
    const link = this.links.find(hostId);
    if (!link) return { kind: 'host_offline' };
    if (!link.capabilities.includes('port.forward')) return { kind: 'not_supported' };

    const message: PortListMessage = { type: 'port.list', commandId: randomUUID(), sessionId };
    // Waiting before sending, so an answer faster than this line cannot be missed.
    const pending = this.replies.expect(hostId, message.commandId, PORT_LIST_TIMEOUT_MS);
    if (!link.send(message)) {
      pending.cancel();
      return { kind: 'host_offline' };
    }
    const reply = await pending.reply;
    if (!reply) return { kind: 'timed_out' };
    if (reply.type === 'command.failed') {
      return { kind: 'failed', code: reply.code, detail: reply.detail };
    }
    if (reply.type !== 'port.listing') return { kind: 'failed', code: 'UNEXPECTED_REPLY' };
    return { kind: 'listed', ports: reply.ports };
  }
}
