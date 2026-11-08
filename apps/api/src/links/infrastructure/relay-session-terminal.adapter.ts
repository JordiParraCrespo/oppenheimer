import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { TerminalDriveMessage } from '@oppenheimer/shared/protocol';
import type {
  SessionTerminalOutcome,
  SessionTerminalPort,
  TerminalDriveRequest,
} from '../../sessions/application/session-terminal.port';
import type { LinkRegistryPort } from '../application/link-registry.port';
import type { LinkRepliesPort } from '../application/link-replies.port';
import { LINK_REGISTRY, LINK_REPLIES } from '../links.di-tokens';

/** How long past the drive's own wait its screen may take to come back. */
export const TERMINAL_REPLY_GRACE_MS = 10_000;

/**
 * `SessionTerminalPort` over the runner link: `terminal.drive` with a fresh
 * `commandId`, then the `terminal.screen` or `command.failed` that names it.
 * Sent only to a runner whose hello named `terminal.drive`.
 */
@Injectable()
export class RelaySessionTerminalAdapter implements SessionTerminalPort {
  constructor(
    @Inject(LINK_REGISTRY)
    private readonly links: LinkRegistryPort,
    @Inject(LINK_REPLIES)
    private readonly replies: LinkRepliesPort,
  ) {}

  async drive(
    hostId: string,
    sessionId: string,
    request: TerminalDriveRequest,
  ): Promise<SessionTerminalOutcome> {
    const link = this.links.find(hostId);
    if (!link) return { kind: 'host_offline' };
    if (!link.capabilities.includes('terminal.drive')) return { kind: 'not_supported' };

    const message: TerminalDriveMessage = {
      type: 'terminal.drive',
      commandId: randomUUID(),
      sessionId,
      ...request,
    };
    const waitMs = request.waitSeconds * 1000 + TERMINAL_REPLY_GRACE_MS;
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
    if (reply.type !== 'terminal.screen') return { kind: 'failed', code: 'UNEXPECTED_REPLY' };
    const { type: _type, commandId: _commandId, ...screen } = reply;
    return { kind: 'screen', screen };
  }
}
