import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { ComputerActMessage } from '@oppenheimer/shared/protocol';
import type {
  HostComputerOutcome,
  HostComputerPort,
  HostComputerRequest,
} from '../../sessions/application/host-computer.port';
import type { LinkRegistryPort } from '../application/link-registry.port';
import type { LinkRepliesPort } from '../application/link-replies.port';
import { LINK_REGISTRY, LINK_REPLIES } from '../links.di-tokens';

/**
 * How long past an action's own wait its screen may take to come back: the
 * runner finds the screen, acts, lets it settle and captures it, each a tool
 * it gives 20 seconds at most.
 */
export const HOST_COMPUTER_REPLY_GRACE_MS = 60_000;

/**
 * `HostComputerPort` over the runner link: `computer.act` with a fresh
 * `commandId`, then the `computer.screen` or `command.failed` that names it,
 * through `LinkRepliesPort`. Sent only to a runner whose hello named
 * `computer.use`; an older one would log the frame as unknown and never
 * answer.
 */
@Injectable()
export class RelayHostComputerAdapter implements HostComputerPort {
  constructor(
    @Inject(LINK_REGISTRY)
    private readonly links: LinkRegistryPort,
    @Inject(LINK_REPLIES)
    private readonly replies: LinkRepliesPort,
  ) {}

  async act(
    hostId: string,
    request: HostComputerRequest,
    commandId?: string,
  ): Promise<HostComputerOutcome> {
    const link = this.links.find(hostId);
    if (!link) return { kind: 'host_offline' };
    if (!link.capabilities.includes('computer.use')) return { kind: 'not_supported' };

    const message: ComputerActMessage = {
      type: 'computer.act',
      commandId: commandId ?? randomUUID(),
      ...request,
    };
    const waitMs = (request.seconds ?? 0) * 1000 + HOST_COMPUTER_REPLY_GRACE_MS;
    // Waiting before sending, so an answer faster than this line cannot be missed.
    const pending = this.replies.expect(hostId, message.commandId, waitMs);
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
    if (reply.type !== 'computer.screen') return { kind: 'failed', code: 'UNEXPECTED_REPLY' };
    const { type: _type, commandId: _commandId, ...screen } = reply;
    return { kind: 'screen', screen };
  }
}
