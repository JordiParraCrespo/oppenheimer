import { describe, expect, it, vi } from 'vitest';
import type { LinkRegistryPort } from '../../links/application/link-registry.port';
import type { HostUsagePort } from '../application/host-usage.port';
import { HostUsageRegistry } from '../application/host-usage.registry';
import type { HostPresence } from '../database/host.repository.port';
import type { HostEntity } from '../domain/host.entity';

function presence(id: string, online = true): HostPresence {
  return { host: { id } as HostEntity, online, inventory: null, vitals: null, network: null };
}

function usage(counts: Record<string, number>): HostUsagePort {
  return { countRunningSessions: vi.fn(async () => new Map(Object.entries(counts))) };
}

describe('HostUsageRegistry', () => {
  it('reads a host no contribution mentions as running nothing', async () => {
    const registry = new HostUsageRegistry();
    registry.register(usage({ a: 2 }));

    const overview = await registry.overview([presence('a'), presence('b', false)]);

    expect(overview).toEqual([
      { ...presence('a'), runningSessions: 2, liveCapabilities: null },
      { ...presence('b', false), runningSessions: 0, liveCapabilities: null },
    ]);
  });

  it("carries what a host's live link said it takes, and nothing for a host with no link here", async () => {
    const links = {
      find: (hostId: string) => (hostId === 'a' ? { capabilities: ['session.cloud'] } : undefined),
    } as unknown as LinkRegistryPort;

    const overview = await new HostUsageRegistry(links).overview([presence('a'), presence('b')]);

    expect(overview.map((host) => host.liveCapabilities)).toEqual([['session.cloud'], null]);
  });

  it('answers with nothing running when no module contributed, rather than refusing', async () => {
    const [bare] = await new HostUsageRegistry().overview([presence('a')]);

    expect(bare.runningSessions).toBe(0);
  });

  it('adds up what every contribution counts, so a second kind of work is not a rewrite', async () => {
    const registry = new HostUsageRegistry();
    registry.registerAll([usage({ a: 2 }), usage({ a: 1 })]);

    const [a] = await registry.overview([presence('a')]);

    expect(a.runningSessions).toBe(3);
  });

  it('asks each contribution once for the whole list, not once per host', async () => {
    const registry = new HostUsageRegistry();
    const sessions = usage({});
    registry.register(sessions);

    await registry.overview([presence('a'), presence('b'), presence('c')]);

    expect(sessions.countRunningSessions).toHaveBeenCalledTimes(1);
    expect(sessions.countRunningSessions).toHaveBeenCalledWith(['a', 'b', 'c']);
  });

  it('asks nothing for an empty list', async () => {
    const registry = new HostUsageRegistry();
    const sessions = usage({});
    registry.register(sessions);

    expect(await registry.overview([])).toEqual([]);
    expect(sessions.countRunningSessions).not.toHaveBeenCalled();
  });
});
