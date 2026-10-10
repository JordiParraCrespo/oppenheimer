import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { HostUnpairedDomainEvent } from '../domain/events/host-unpaired.domain-event';
import { HostEntity, platformLabelOf } from '../domain/host.entity';
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
      maxSessions: null,
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

describe('platformLabelOf', () => {
  it('puts the platform before a bare release', () => {
    expect(platformLabelOf('macos', '15.2')).toBe('macos 15.2');
    expect(platformLabelOf('ubuntu', '24.04')).toBe('ubuntu 24.04');
  });

  it('lets a distribution name that already says the platform stand alone', () => {
    expect(platformLabelOf('ubuntu', 'Ubuntu 24.04.4 LTS')).toBe('Ubuntu 24.04.4 LTS');
    expect(platformLabelOf('debian', 'Debian GNU/Linux 12 (bookworm)')).toBe(
      'Debian GNU/Linux 12 (bookworm)',
    );
  });

  it('is the platform alone when no release is known', () => {
    expect(platformLabelOf('linux', null)).toBe('linux');
    expect(platformLabelOf('linux', '')).toBe('linux');
  });
});

describe('HostEntity.sessionLimit', () => {
  const GIB = 1024 ** 3;

  it('is what the owner set, whatever the machine reported', () => {
    const subject = host({ maxSessions: 8, capabilities: { cpus: 2, memoryTotalBytes: 4 * GIB } });

    expect(subject.sessionLimit).toBe(8);
  });

  it('defaults to one per CPU and one per 2 GiB, whichever is fewer', () => {
    expect(host({ capabilities: { cpus: 4, memoryTotalBytes: 7.6 * GIB } }).sessionLimit).toBe(3);
    expect(host({ capabilities: { cpus: 2, memoryTotalBytes: 64 * GIB } }).sessionLimit).toBe(2);
  });

  it('never defaults below one session, so a small machine can still run something', () => {
    expect(host({ capabilities: { cpus: 1, memoryTotalBytes: 1 * GIB } }).sessionLimit).toBe(1);
  });

  it('does not limit a host that has not reported its size', () => {
    expect(host().sessionLimit).toBeNull();
  });

  it('goes back to the default when the owner clears the limit', () => {
    const subject = host({ maxSessions: 8, capabilities: { cpus: 4, memoryTotalBytes: 16 * GIB } });

    subject.limitSessions(null);

    expect(subject.maxSessions).toBeNull();
    expect(subject.sessionLimit).toBe(4);
  });

  it('refuses a limit the schema would, so no path stores one', () => {
    expect(() => host().limitSessions(0)).toThrow();
    expect(() => host().limitSessions(65)).toThrow();
    expect(() => host().limitSessions(2.5)).toThrow();
  });
});
