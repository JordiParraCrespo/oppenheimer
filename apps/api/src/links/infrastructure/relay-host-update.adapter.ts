import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { HostUpdateMessage } from '@oppenheimer/shared/protocol';
import type { HostUpdateOutcome, HostUpdatePort } from '../../hosts/application/host-update.port';
import type { LinkRegistryPort } from '../application/link-registry.port';
import { LINK_REGISTRY } from '../links.di-tokens';

/**
 * `HostUpdatePort` over the runner link: one `host.update` with a fresh
 * `commandId` and no `version`, so the runner takes the newest release on its
 * channel and is left unpinned. A refusal comes back as a `command.failed`
 * nothing here waits for; the runner logs it.
 */
@Injectable()
export class RelayHostUpdateAdapter implements HostUpdatePort {
  constructor(
    @Inject(LINK_REGISTRY)
    private readonly links: LinkRegistryPort,
  ) {}

  request(hostId: string, channel: string): HostUpdateOutcome {
    const link = this.links.find(hostId);
    if (!link) return { kind: 'host_offline' };

    const message: HostUpdateMessage = { type: 'host.update', commandId: randomUUID(), channel };
    return link.send(message) ? { kind: 'requested' } : { kind: 'host_offline' };
  }
}
