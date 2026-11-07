import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { HostExecMessage } from '@oppenheimer/shared/protocol';
import type {
  HostExecOutcome,
  HostExecPort,
  HostExecRequest,
} from '../../sessions/application/host-exec.port';
import type { LinkRegistryPort } from '../application/link-registry.port';
import type { LinkRepliesPort } from '../application/link-replies.port';
import { LINK_REGISTRY, LINK_REPLIES } from '../links.di-tokens';

/**
 * How long past the run's own timeout the answer may take: the runner kills
 * the run at its timeout, then sends what it printed.
 */
export const HOST_EXEC_REPLY_GRACE_MS = 15_000;

/**
 * `HostExecPort` over the runner link: `host.exec` with a fresh `commandId`,
 * then the `host.exec.result` or `command.failed` that names it, through
 * `LinkRepliesPort`. Sent only to a runner whose hello named `host.exec`; an
 * older one would log the frame as unknown and never answer.
 */
@Injectable()
export class RelayHostExecAdapter implements HostExecPort {
  constructor(
    @Inject(LINK_REGISTRY)
    private readonly links: LinkRegistryPort,
    @Inject(LINK_REPLIES)
    private readonly replies: LinkRepliesPort,
  ) {}

  async run(hostId: string, request: HostExecRequest): Promise<HostExecOutcome> {
    const link = this.links.find(hostId);
    if (!link) return { kind: 'host_offline' };
    if (!link.capabilities.includes('host.exec')) return { kind: 'not_supported' };

    const message: HostExecMessage = { type: 'host.exec', commandId: randomUUID(), ...request };
    const waitMs = request.timeoutSeconds * 1000 + HOST_EXEC_REPLY_GRACE_MS;
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
    if (reply.type !== 'host.exec.result') return { kind: 'failed', code: 'UNEXPECTED_REPLY' };
    const { type: _type, commandId: _commandId, ...run } = reply;
    return { kind: 'ran', run };
  }
}
