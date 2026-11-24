import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { HostSettingsSetMessage } from '@oppenheimer/shared/protocol';
import type {
  HostSettingsChange,
  HostSettingsOutcome,
  HostSettingsPort,
} from '../../sessions/application/host-settings.port';
import type { LinkRegistryPort } from '../application/link-registry.port';
import type { LinkRepliesPort } from '../application/link-replies.port';
import { LINK_REGISTRY, LINK_REPLIES } from '../links.di-tokens';

/** How long the runner has to write the files and answer. */
export const HOST_SETTINGS_REPLY_MS = 15_000;

/**
 * `HostSettingsPort` over the runner link: `host.settings.set`, then the
 * `host.settings` or `command.failed` that names it. Sent only to a runner
 * whose hello named `host.settings`; an older one would never answer.
 */
@Injectable()
export class RelayHostSettingsAdapter implements HostSettingsPort {
  constructor(
    @Inject(LINK_REGISTRY)
    private readonly links: LinkRegistryPort,
    @Inject(LINK_REPLIES)
    private readonly replies: LinkRepliesPort,
  ) {}

  async set(hostId: string, change: HostSettingsChange): Promise<HostSettingsOutcome> {
    const link = this.links.find(hostId);
    if (!link) return { kind: 'host_offline' };
    if (!link.capabilities.includes('host.settings')) return { kind: 'not_supported' };

    const message: HostSettingsSetMessage = {
      type: 'host.settings.set',
      commandId: randomUUID(),
      ...change,
    };
    // Waiting before sending, so an answer faster than this line cannot be missed.
    const pending = this.replies.expect(hostId, message.commandId, HOST_SETTINGS_REPLY_MS);
    if (!link.send(message)) {
      pending.cancel();
      return { kind: 'host_offline' };
    }
    const reply = await pending.reply;
    if (!reply) return { kind: 'timed_out' };
    if (reply.type === 'command.failed') {
      return { kind: 'failed', code: reply.code, detail: reply.detail };
    }
    if (reply.type !== 'host.settings') return { kind: 'failed', code: 'UNEXPECTED_REPLY' };
    const { type: _type, commandId: _commandId, ...settings } = reply;
    return { kind: 'set', settings };
  }
}
