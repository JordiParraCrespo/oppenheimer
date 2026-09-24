import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { HostUnpairedDomainEvent } from '../domain/events/host-unpaired.domain-event';
import { HostEntity } from '../domain/host.entity';
import { keyFingerprint } from '../infrastructure/host-assertion.util';

function key() {
  const { publicKey } = generateKeyPairSync('ed25519');
  const base64 = publicKey.export({ format: 'der', type: 'spki' }).subarray(12).toString('base64');
  return { base64, fingerprint: keyFingerprint(base64) as string };
}

function host(overrides: Partial<Parameters<typeof HostEntity.create>[0]['props']> = {}) {
  const current = key();
  return HostEntity.create({
    id: 'host-1',
    props: {
      ownerUserId: 'jordi',
      name: 'Dev box',
      hostname: 'devbox.local',
      os: 'macos',
      arch: 'arm64',
      runnerVersion: null,
      capabilities: null,
      publicKey: current.base64,
      publicKeyFingerprint: current.fingerprint,
      lastSeenAt: null,
      unpairedAt: null,
      ...overrides,
    },
  });
}

describe('HostEntity.register', () => {
  it('raises the event that says a machine finished pairing', () => {
    const current = key();

    const registered = HostEntity.register({
      id: 'host-1',
      ownerUserId: 'jordi',
      name: 'Dev box',
      publicKey: current.base64,
      publicKeyFingerprint: current.fingerprint,
      pairingTokenId: 'token-1',
    });

    expect(registered.domainEvents).toHaveLength(1);
    expect(registered.domainEvents[0]).toMatchObject({
      aggregateId: registered.id,
      ownerUserId: 'jordi',
      publicKeyFingerprint: current.fingerprint,
      pairingTokenId: 'token-1',
    });
  });

  it('is the key the machine presented, and the fingerprint of it', () => {
    const current = key();
    const registered = HostEntity.register({
      id: 'host-1',
      ownerUserId: 'jordi',
      name: 'Dev box',
      publicKey: current.base64,
      publicKeyFingerprint: current.fingerprint,
      pairingTokenId: 'token-1',
    });

    // The id is the one the redemption statement recorded, not one the aggregate
    // minted for itself — the row the statement named has to be this row.
    expect(registered.id).toBe('host-1');
    expect(registered.publicKey).toBe(current.base64);
    expect(registered.hasFingerprint(current.fingerprint)).toBe(true);
    expect(registered.hasFingerprint('f'.repeat(64))).toBe(false);
  });
});

describe('unpair', () => {
  it('is idempotent, because both ends can do it', () => {
    const subject = host();
    const at = new Date('2026-09-19T12:00:00Z');

    subject.unpair(at);
    subject.unpair(new Date('2026-09-20T12:00:00Z'));

    // The console and the machine itself both unpair, and neither knows whether
    // the other already did; the first answer is the one that stands.
    expect(subject.unpairedAt).toEqual(at);
    expect(subject.isUnpaired).toBe(true);
  });

  it('raises HostUnpaired once, so the relay can close a link the host still holds', () => {
    const subject = host();

    subject.unpair();
    subject.unpair();

    const raised = subject.domainEvents.filter((event) => event instanceof HostUnpairedDomainEvent);
    expect(raised).toHaveLength(1);
    expect(raised[0]).toMatchObject({ aggregateId: 'host-1', ownerUserId: 'jordi' });
  });
});

describe('invariants', () => {
  it('refuses a fingerprint that is not a SHA-256 digest', () => {
    expect(() => host({ publicKeyFingerprint: 'abc' })).toThrow();
  });

  it('refuses a host with no owner', () => {
    expect(() => host({ ownerUserId: '' })).toThrow();
  });

  it('refuses an empty name, on create and on rename', () => {
    expect(() => host({ name: '' })).toThrow();
    expect(() => host().rename('  ')).toThrow();
  });
});
