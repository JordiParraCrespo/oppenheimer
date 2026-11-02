import { describe, expect, it, vi } from 'vitest';
import type { LinkRegistryPort, RunnerLink } from '../../links/application/link-registry.port';
import { HostReadResolver } from '../application/host-read.resolver';
import { HostUsageRegistry } from '../application/host-usage.registry';
import type { HostPresence } from '../database/host.repository.port';
import type { HostEntity } from '../domain/host.entity';

/**
 * The host read: the usage registry's counts, and what each runner's live link
 * in this process said it takes. The cloud decision on top is
 * `host-cloud.policy.spec.ts`.
 */
function presence(id: string): HostPresence {
  return { host: { id } as HostEntity, online: true, inventory: null, vitals: null, network: null };
}

describe('HostReadResolver', () => {
  it("carries what a host's live link said it takes, and nothing for a host with no link here", async () => {
    const usage = new HostUsageRegistry();
    usage.register({ countRunningSessions: vi.fn(async () => new Map([['a', 1]])) });
    const links: Pick<LinkRegistryPort, 'find'> = {
      find: (hostId) =>
        hostId === 'a'
          ? ({ capabilities: ['session.cloud'] } as Partial<RunnerLink> as RunnerLink)
          : undefined,
    };

    const reads = await new HostReadResolver(usage, links as LinkRegistryPort).read([
      presence('a'),
      presence('b'),
    ]);

    expect(
      reads.map(({ runningSessions, liveCapabilities }) => ({ runningSessions, liveCapabilities })),
    ).toEqual([
      { runningSessions: 1, liveCapabilities: ['session.cloud'] },
      { runningSessions: 0, liveCapabilities: null },
    ]);
  });
});
