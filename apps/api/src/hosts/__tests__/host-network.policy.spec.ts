import { describe, expect, it } from 'vitest';
import type { HostNetwork } from '../domain/host-metadata.types';
import { networkMoveIsNotable } from '../domain/host-network.policy';
import { isPrivate } from '../infrastructure/dbip-geolocation.adapter';

function network(overrides: Partial<HostNetwork>): HostNetwork {
  return {
    id: 'n',
    ip: '203.0.113.7',
    countryCode: 'ES',
    region: null,
    city: 'Madrid',
    asn: 3352,
    asnOrg: 'Telefonica',
    firstSeenAt: new Date(),
    lastSeenAt: new Date(),
    ...overrides,
  };
}

describe('networkMoveIsNotable', () => {
  const home = network({});

  it('mails nobody for a new address on the same operator in the same country', () => {
    expect(networkMoveIsNotable(home, network({ ip: '203.0.113.99', city: 'Barcelona' }))).toBe(
      false,
    );
  });

  it('is notable when the country changes', () => {
    expect(networkMoveIsNotable(home, network({ countryCode: 'FR' }))).toBe(true);
  });

  it('is notable when the network operator changes', () => {
    expect(networkMoveIsNotable(home, network({ asn: 16276 }))).toBe(true);
  });

  it('never guesses: without geography on both sides nothing is notable', () => {
    const unplaced = network({ countryCode: null, asn: null });
    expect(networkMoveIsNotable(home, unplaced)).toBe(false);
    expect(networkMoveIsNotable(unplaced, home)).toBe(false);
  });
});

describe('isPrivate', () => {
  it.each([
    '10.1.2.3',
    '127.0.0.1',
    '172.16.0.1',
    '192.168.1.1',
    '100.64.0.1',
    '::1',
    'fd00::1',
    'fe80::1',
    '::ffff:10.0.0.4',
  ])('reads %s as private', (ip) => expect(isPrivate(ip)).toBe(true));

  it.each(['8.8.8.8', '172.32.0.1', '2a00:1450:4001:80b::200e', '::ffff:8.8.8.8'])(
    'reads %s as public',
    (ip) => expect(isPrivate(ip)).toBe(false),
  );
});
