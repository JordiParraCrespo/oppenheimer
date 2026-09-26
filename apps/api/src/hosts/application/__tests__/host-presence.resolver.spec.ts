import type { HostFactsDto } from '@oppenheimer/shared';
import { None, Some } from 'oxide.ts';
import { describe, expect, it, vi } from 'vitest';
import type { HostRepositoryPort } from '../../database/host.repository.port';
import type { HostMetadataRepositoryPort } from '../../database/host-metadata.repository.port';
import type { HostEntity } from '../../domain/host.entity';
import { HostPresenceResolver } from '../host-presence.resolver';

const facts = {
  platform: 'ubuntu',
  arch: 'amd64',
  hostname: 'optimus',
  user: 'jordi',
  home: '/home/jordi',
  root: false,
  tools: [],
  workspacePath: '',
  diskFreeBytes: 42,
  runnerVersion: '0.14.2',
} satisfies HostFactsDto;

function setup(host: Partial<HostEntity> | null) {
  const hosts = {
    findOneByIdForMachine: vi.fn().mockResolvedValue(host ? Some(host) : None),
  } as unknown as HostRepositoryPort;
  const metadata = {
    recordVitals: vi.fn().mockResolvedValue(undefined),
    recordInventory: vi.fn().mockResolvedValue([]),
  } as unknown as HostMetadataRepositoryPort;
  return { hosts, metadata, resolver: new HostPresenceResolver(hosts, metadata) };
}

describe('HostPresenceResolver', () => {
  it('writes the live numbers to presence and the facts to the inventory', async () => {
    const { metadata, resolver } = setup({ isUnpaired: false });
    const at = new Date('2026-09-26T10:00:00Z');

    await expect(
      resolver.observe(
        'host-1',
        { facts, channel: 'stable', loadAverage: 1.5, roundTripMillis: 41 },
        at,
      ),
    ).resolves.toBe(true);

    expect(metadata.recordVitals).toHaveBeenCalledWith(
      'host-1',
      expect.objectContaining({ loadAverage: 1.5, roundTripMillis: 41, diskFreeBytes: 42 }),
      at,
    );
    expect(metadata.recordInventory).toHaveBeenCalledWith(
      'host-1',
      expect.objectContaining({ channel: 'stable', runnerVersion: '0.14.2' }),
      at,
    );
  });

  it('ignores an unpaired host rather than resurrecting it', async () => {
    const { metadata, resolver } = setup({ isUnpaired: true });
    await expect(resolver.observe('host-1', { facts })).resolves.toBe(false);
    expect(metadata.recordVitals).not.toHaveBeenCalled();
  });

  it('ignores a host it does not know', async () => {
    const { metadata, resolver } = setup(null);
    await expect(resolver.observe('host-1', { facts })).resolves.toBe(false);
    expect(metadata.recordInventory).not.toHaveBeenCalled();
  });
});
