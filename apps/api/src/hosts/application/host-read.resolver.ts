import { Inject, Injectable } from '@nestjs/common';
import type { RunnerCapability } from '@oppenheimer/shared/protocol';
import type { LinkRegistryPort } from '../../links/application/link-registry.port';
import { LINK_REGISTRY } from '../../links/links.di-tokens';
import type { HostPresence } from '../database/host.repository.port';
import { type HostOverview, HostUsageRegistry } from './host-usage.registry';

/**
 * A host as the console reads it: its overview, and what its runner's live
 * link said it takes (`null` when this process holds no link for it).
 */
export interface HostRead extends HostOverview {
  liveCapabilities: readonly RunnerCapability[] | null;
}

/**
 * Assembles the host reads: what runs on each host, from the usage registry,
 * and what each runner takes right now, from this process's live links.
 */
@Injectable()
export class HostReadResolver {
  constructor(
    private readonly usage: HostUsageRegistry,
    @Inject(LINK_REGISTRY)
    private readonly links: LinkRegistryPort,
  ) {}

  async read(presences: readonly HostPresence[]): Promise<HostRead[]> {
    const overviews = await this.usage.overview(presences);
    return overviews.map((overview) => ({
      ...overview,
      liveCapabilities: this.links.find(overview.host.id)?.capabilities ?? null,
    }));
  }
}
