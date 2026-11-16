import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { SessionWindowAgent } from '@oppenheimer/shared';
import type {
  SessionWindowCloseMessage,
  SessionWindowOpenMessage,
  SessionWindowsListMessage,
} from '@oppenheimer/shared/protocol';
import type {
  SessionWindowOpenOutcome,
  SessionWindowsOutcome,
  SessionWindowsPort,
} from '../../sessions/application/session-windows.port';
import type { LinkRegistryPort } from '../application/link-registry.port';
import type { LinkRepliesPort } from '../application/link-replies.port';
import { LINK_REGISTRY, LINK_REPLIES } from '../links.di-tokens';

/**
 * How long a window command may take: a tmux call or two on the host, a
 * moment even on a busy one. Past this the tab says the host did not answer.
 */
export const SESSION_WINDOWS_TIMEOUT_MS = 5_000;

type WindowCommand =
  | SessionWindowsListMessage
  | SessionWindowOpenMessage
  | SessionWindowCloseMessage;

/**
 * `SessionWindowsPort` over the runner link: `session.windows.list`,
 * `session.window.open` or `session.window.close` with a fresh `commandId`,
 * then the `session.windows` or `command.failed` that names it, through
 * `LinkRepliesPort`. Sent only to a runner whose hello named
 * `session.windows.list`: an older one opens a window without a word back.
 * An open that names an agent goes only to a runner that also named
 * `session.window.agent`: an older one would open a plain shell and ignore it.
 */
@Injectable()
export class RelaySessionWindowsAdapter implements SessionWindowsPort {
  constructor(
    @Inject(LINK_REGISTRY)
    private readonly links: LinkRegistryPort,
    @Inject(LINK_REPLIES)
    private readonly replies: LinkRepliesPort,
  ) {}

  list(hostId: string, sessionId: string): Promise<SessionWindowsOutcome> {
    return this.ask(hostId, { type: 'session.windows.list', commandId: randomUUID(), sessionId });
  }

  open(
    hostId: string,
    sessionId: string,
    agent?: SessionWindowAgent,
  ): Promise<SessionWindowOpenOutcome> {
    // A runner that answers no window command at all is `not_supported`
    // from `ask`, as for a shell; only one that opens shells but not agents
    // is told apart.
    const capabilities = this.links.find(hostId)?.capabilities ?? [];
    if (
      agent !== undefined &&
      capabilities.includes('session.windows.list') &&
      !capabilities.includes('session.window.agent')
    ) {
      return Promise.resolve({ kind: 'agent_not_supported' });
    }
    return this.ask(hostId, {
      type: 'session.window.open',
      commandId: randomUUID(),
      sessionId,
      ...(agent !== undefined ? { agent } : {}),
    });
  }

  close(hostId: string, sessionId: string, window: number): Promise<SessionWindowsOutcome> {
    return this.ask(hostId, {
      type: 'session.window.close',
      commandId: randomUUID(),
      sessionId,
      window,
    });
  }

  private async ask(hostId: string, message: WindowCommand): Promise<SessionWindowsOutcome> {
    const link = this.links.find(hostId);
    if (!link) return { kind: 'host_offline' };
    if (!link.capabilities.includes('session.windows.list')) return { kind: 'not_supported' };

    // Waiting before sending, so an answer faster than this line cannot be missed.
    const pending = this.replies.expect(hostId, message.commandId, SESSION_WINDOWS_TIMEOUT_MS);
    if (!link.send(message)) {
      pending.cancel();
      return { kind: 'host_offline' };
    }
    const reply = await pending.reply;
    if (!reply) return { kind: 'timed_out' };
    if (reply.type === 'command.failed') {
      return { kind: 'failed', code: reply.code, detail: reply.detail };
    }
    if (reply.type !== 'session.windows' || reply.sessionId !== message.sessionId) {
      return { kind: 'failed', code: 'UNEXPECTED_REPLY' };
    }
    return {
      kind: 'listed',
      windows: reply.windows,
      ...(reply.opened !== undefined ? { opened: reply.opened } : {}),
    };
  }
}
