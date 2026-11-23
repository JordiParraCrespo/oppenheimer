import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { BrowserActMessage } from '@oppenheimer/shared/protocol';
import type {
  HostBrowserOutcome,
  HostBrowserPort,
  HostBrowserRequest,
} from '../../sessions/application/host-browser.port';
import type { LinkRegistryPort } from '../application/link-registry.port';
import type { LinkRepliesPort } from '../application/link-replies.port';
import { LINK_REGISTRY, LINK_REPLIES } from '../links.di-tokens';

/**
 * How long past an action's own wait its page may take to come back: the
 * runner may start the browser (20 seconds at most), act, wait for the page
 * to load (15) and read it.
 */
export const HOST_BROWSER_REPLY_GRACE_MS = 75_000;

/**
 * `HostBrowserPort` over the runner link: `browser.act` with a fresh
 * `commandId`, then the `browser.page` or `command.failed` that names it,
 * through `LinkRepliesPort`. Sent only to a runner whose hello named
 * `browser.use`; an older one would log the frame as unknown and never
 * answer.
 */
@Injectable()
export class RelayHostBrowserAdapter implements HostBrowserPort {
  constructor(
    @Inject(LINK_REGISTRY)
    private readonly links: LinkRegistryPort,
    @Inject(LINK_REPLIES)
    private readonly replies: LinkRepliesPort,
  ) {}

  async act(
    hostId: string,
    request: HostBrowserRequest,
    commandId?: string,
  ): Promise<HostBrowserOutcome> {
    const link = this.links.find(hostId);
    if (!link) return { kind: 'host_offline' };
    if (!link.capabilities.includes('browser.use')) return { kind: 'not_supported' };

    const message: BrowserActMessage = {
      type: 'browser.act',
      commandId: commandId ?? randomUUID(),
      ...request,
    };
    const waitMs = (request.seconds ?? 0) * 1000 + HOST_BROWSER_REPLY_GRACE_MS;
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
    if (reply.type !== 'browser.page') return { kind: 'failed', code: 'UNEXPECTED_REPLY' };
    const { type: _type, commandId: _commandId, ...page } = reply;
    return { kind: 'page', page };
  }
}
