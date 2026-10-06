import type { HostFactsDto } from '@oppenheimer/shared';
import { None, Some } from 'oxide.ts';
import { describe, expect, it, vi } from 'vitest';
import type { CredentialOwnerPort } from '../../../auth/application/credential-owner.port';
import type { HostRepositoryPort } from '../../database/host.repository.port';
import type { HostMetadataRepositoryPort } from '../../database/host-metadata.repository.port';
import type { HostEntity } from '../../domain/host.entity';
import type { IpGeolocationPort } from '../../infrastructure/ip-geolocation.port';
import {
  HostPresenceResolver,
  OFFLINE_ANNOUNCE_DELAY_MS,
  OWNER_RECHECK_MS,
} from '../host-presence.resolver';

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
    // The statement answers the pairing check: a host the row belongs to and
    // that is still paired is the only one it writes for.
    recordVitalsIfPaired: vi.fn().mockResolvedValue(host !== null && host.isUnpaired !== true),
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
  const owners = { findActiveOwner: vi.fn().mockResolvedValue({ id: 'jordi' }) };
  const events = { publish: vi.fn() };
  return {
    hosts,
    metadata,
    geolocation,
    owners,
    events,
    resolver: new HostPresenceResolver(
      hosts,
      metadata,
      geolocation,
      owners as unknown as CredentialOwnerPort,
      events,
    ),
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
    ).resolves.toBe('recorded');

    expect(metadata.recordVitalsIfPaired).toHaveBeenCalledWith(
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

  it('asks the one statement whether the host is paired, and the host row only for its owner, once', async () => {
    const { hosts, metadata, owners, resolver } = setup({
      isUnpaired: false,
      ownerUserId: 'jordi',
    });
    const at = new Date('2026-09-26T10:00:00Z');
    await resolver.observe('host-1', { facts }, at);
    await resolver.observe('host-1', { facts }, new Date(at.getTime() + 15_000));
    await resolver.observe('host-1', { facts }, new Date(at.getTime() + 30_000));
    expect(metadata.recordVitalsIfPaired).toHaveBeenCalledTimes(3);
    expect(hosts.findOneByIdForMachine).toHaveBeenCalledTimes(1);
    expect(owners.findActiveOwner).toHaveBeenCalledTimes(1);
  });

  it('ignores an unpaired host rather than resurrecting it', async () => {
    const { metadata, resolver } = setup({ isUnpaired: true });
    await expect(resolver.observe('host-1', { facts })).resolves.toBe('unpaired');
    expect(metadata.recordInventory).not.toHaveBeenCalled();
  });

  it('answers unpaired from the statement once the owner is known', async () => {
    const { metadata, resolver } = setup({ isUnpaired: false, ownerUserId: 'jordi' });
    await resolver.observe('host-1', { facts });
    vi.mocked(metadata.recordVitalsIfPaired).mockResolvedValue(false);
    await expect(resolver.observe('host-1', { facts })).resolves.toBe('unpaired');
  });

  it('ignores a host it does not know', async () => {
    const { metadata, resolver } = setup(null);
    await expect(resolver.observe('host-1', { facts })).resolves.toBe('unpaired');
    expect(metadata.recordInventory).not.toHaveBeenCalled();
  });

  it('skips the inventory on a heartbeat that reports what this process last recorded', async () => {
    const { metadata, resolver } = setup({ isUnpaired: false });
    await resolver.observe('host-1', { facts, channel: 'stable' });
    await resolver.observe('host-1', { facts, channel: 'stable' });
    // A beat that names no channel keeps the one on file, so it is unchanged too.
    await resolver.observe('host-1', { facts });
    expect(metadata.recordVitalsIfPaired).toHaveBeenCalledTimes(3);
    expect(metadata.recordInventory).toHaveBeenCalledTimes(1);
  });

  it('records the inventory again when the facts or the channel move', async () => {
    const { metadata, resolver } = setup({ isUnpaired: false });
    await resolver.observe('host-1', { facts, channel: 'stable' });
    await resolver.observe('host-1', { facts, channel: 'beta' });
    await resolver.observe('host-1', { facts: { ...facts, runnerVersion: '0.15.0' } });
    expect(metadata.recordInventory).toHaveBeenCalledTimes(3);
  });

  it('always reads the inventory on a hello, whatever this process remembers', async () => {
    const { metadata, resolver } = setup({ isUnpaired: false });
    await resolver.observe('host-1', { facts });
    await resolver.observe('host-1', { facts, connectedAt: new Date() });
    expect(metadata.recordInventory).toHaveBeenCalledTimes(2);
  });

  it('refuses, without recording, a host whose owner may not act', async () => {
    const { metadata, owners, resolver } = setup({ isUnpaired: false, ownerUserId: 'jordi' });
    owners.findActiveOwner.mockResolvedValue(null);

    await expect(resolver.observe('host-1', { facts })).resolves.toBe('owner_refused');
    expect(owners.findActiveOwner).toHaveBeenCalledWith('jordi');
    expect(metadata.recordVitalsIfPaired).not.toHaveBeenCalled();
  });

  it('notices a ban on an open link within a minute of heartbeats, and on any hello', async () => {
    const { owners, resolver } = setup({ isUnpaired: false, ownerUserId: 'jordi' });
    const at = new Date('2026-09-26T10:00:00Z');
    const later = (ms: number) => new Date(at.getTime() + ms);
    await resolver.observe('host-1', { facts }, at);
    owners.findActiveOwner.mockResolvedValue(null);

    await expect(resolver.observe('host-1', { facts }, later(30_000))).resolves.toBe('recorded');
    await expect(resolver.observe('host-1', { facts }, later(OWNER_RECHECK_MS))).resolves.toBe(
      'owner_refused',
    );
    owners.findActiveOwner.mockResolvedValue({ id: 'jordi' });
    await resolver.observe('host-1', { facts }, later(OWNER_RECHECK_MS + 1_000));
    owners.findActiveOwner.mockResolvedValue(null);
    await expect(
      resolver.observe('host-1', { facts, connectedAt: later(OWNER_RECHECK_MS + 2_000) }),
    ).resolves.toBe('owner_refused');
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

/**
 * Presence is derived on read and never stored, so nothing would otherwise
 * tell the owner's console that a host came or went: these are its two
 * moments, the link opening and the window running out after it closed.
 */
describe('HostPresenceResolver announces presence to the owner', () => {
  it('on a hello, and not on every heartbeat', async () => {
    const { events, resolver } = setup({ ownerUserId: 'jordi', isUnpaired: false });

    await resolver.observe('host-1', { facts, connectedAt: new Date() });
    expect(events.publish).toHaveBeenCalledWith(
      { userId: 'jordi' },
      { type: 'host.changed', id: 'host-1' },
    );

    events.publish.mockClear();
    await resolver.observe('host-1', { facts });
    expect(events.publish).not.toHaveBeenCalled();
  });

  it('never for a hello it refused', async () => {
    const { events, resolver } = setup({ ownerUserId: 'jordi', isUnpaired: true });
    await resolver.observe('host-1', { facts, connectedAt: new Date() });
    expect(events.publish).not.toHaveBeenCalled();
  });

  /** Told at once, the console would re-read a host still inside its online window. */
  it('once the online window has passed after its link closed', async () => {
    vi.useFakeTimers();
    try {
      const { events, resolver } = setup({ ownerUserId: 'jordi', isUnpaired: false });
      resolver.disconnected('host-1');
      expect(events.publish).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(OFFLINE_ANNOUNCE_DELAY_MS);
      expect(events.publish).toHaveBeenCalledWith(
        { userId: 'jordi' },
        { type: 'host.changed', id: 'host-1' },
      );
    } finally {
      vi.useRealTimers();
    }
  });
});
