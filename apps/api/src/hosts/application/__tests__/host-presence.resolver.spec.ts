import type { HostFactsDto } from '@oppenheimer/shared';
import { None, Some } from 'oxide.ts';
import { describe, expect, it, vi } from 'vitest';
import type { HostRepositoryPort } from '../../database/host.repository.port';
import type { HostMetadataRepositoryPort } from '../../database/host-metadata.repository.port';
import type { HostEntity } from '../../domain/host.entity';
import type { IpGeolocationPort } from '../../infrastructure/ip-geolocation.port';
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
    recordNetwork: vi.fn().mockResolvedValue({ network: {}, movedFrom: null }),
  } as unknown as HostMetadataRepositoryPort;
  const geolocation = {
    lookup: vi.fn<IpGeolocationPort['lookup']>().mockResolvedValue({
      countryCode: null,
      region: null,
      city: null,
      asn: null,
      asnOrg: null,
    }),
  };
  return {
    hosts,
    metadata,
    geolocation,
    resolver: new HostPresenceResolver(hosts, metadata, geolocation),
  };
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

  it('records the address with where the database places it', async () => {
    const { metadata, geolocation, resolver } = setup({
      isUnpaired: false,
      ownerUserId: 'jordi',
      name: 'optimus',
    });
    geolocation.lookup.mockResolvedValue({
      countryCode: 'ES',
      region: 'Madrid',
      city: 'Madrid',
      asn: 3352,
      asnOrg: 'Telefonica',
    });

    await resolver.connectedFrom('host-1', '195.235.113.3');

    expect(metadata.recordNetwork).toHaveBeenCalledWith(
      'host-1',
      expect.objectContaining({ ip: '195.235.113.3', countryCode: 'ES', asn: 3352 }),
      expect.any(Date),
      expect.any(Function),
    );
  });

  it('owes the owner a notice only for a move to another country or operator', async () => {
    const { metadata, resolver } = setup({
      isUnpaired: false,
      ownerUserId: 'jordi',
      name: 'optimus',
    });
    await resolver.connectedFrom('host-1', '198.51.100.9');
    const eventsFor = vi.mocked(metadata.recordNetwork).mock.calls[0][3] as NonNullable<
      Parameters<HostMetadataRepositoryPort['recordNetwork']>[3]
    >;
    const place = (countryCode: string, asn: number) => ({
      id: 'n',
      ip: '198.51.100.9',
      countryCode,
      region: null,
      city: null,
      asn,
      asnOrg: null,
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
    });

    expect(eventsFor(place('ES', 3352), place('ES', 3352))).toEqual([]);
    const [notice] = eventsFor(place('ES', 3352), place('FR', 16276));
    expect(notice).toMatchObject({
      aggregateId: 'host-1',
      ownerUserId: 'jordi',
      hostName: 'optimus',
      to: { countryCode: 'FR', asn: 16276 },
    });
  });

  it('records nothing for an unpaired host', async () => {
    const { metadata, resolver } = setup({ isUnpaired: true });
    await resolver.connectedFrom('host-1', '198.51.100.9');
    expect(metadata.recordNetwork).not.toHaveBeenCalled();
  });
});
