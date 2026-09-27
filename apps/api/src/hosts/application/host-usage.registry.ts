import { Injectable } from '@nestjs/common';
import type { HostPresence } from '../database/host.repository.port';
import type { HostUsagePort } from './host-usage.port';

/** A host as the console reads it: the row, whether it is attached, and what runs on it. */
export interface HostOverview extends HostPresence {
  runningSessions: number;
}

/**
 * What the running application can say is running on a host, collected at
 * boot through {@link HostsModule.contributeUsage}.
 *
 * Every contribution is asked and the counts add up, so a second kind of work
 * on a host later (a routine run) is one more contribution rather than an edit
 * here.
 */
@Injectable()
export class HostUsageRegistry {
  private readonly usages: HostUsagePort[] = [];

  register(usage: HostUsagePort): void {
    if (this.usages.includes(usage)) return;
    this.usages.push(usage);
  }

  registerAll(usages: readonly HostUsagePort[]): void {
    for (const usage of usages) this.register(usage);
  }

  /** The presences, each with what runs on it. One round trip per contribution, not per host. */
  async overview(presences: readonly HostPresence[]): Promise<HostOverview[]> {
    const ids = presences.map(({ host }) => host.id);
    const totals = new Map<string, number>();
    if (ids.length > 0) {
      for (const usage of this.usages) {
        const counts = await usage.countRunningSessions(ids);
        for (const [hostId, count] of counts) {
          totals.set(hostId, (totals.get(hostId) ?? 0) + count);
        }
      }
    }
    return presences.map((presence) => ({
      ...presence,
      runningSessions: totals.get(presence.host.id) ?? 0,
    }));
  }
}
