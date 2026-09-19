import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
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
      previousPublicKey: null,
      previousPublicKeyFingerprint: null,
      previousPublicKeyExpiresAt: null,
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

  it('starts with one key and no retired one', () => {
    const current = key();
    const registered = HostEntity.register({
      ownerUserId: 'jordi',
      name: 'Dev box',
      publicKey: current.base64,
      publicKeyFingerprint: current.fingerprint,
      pairingTokenId: 'token-1',
    });

    expect(registered.keysValidAt(new Date())).toEqual([current.base64]);
    expect(registered.previousPublicKey).toBeNull();
  });
});

describe('keysValidAt', () => {
  const now = new Date('2026-09-19T12:00:00Z');

  it('always offers the current key', () => {
    expect(host().keysValidAt(now)).toHaveLength(1);
  });

  it('offers a retired key while its window is open', () => {
    const retired = key();
    const subject = host({
      previousPublicKey: retired.base64,
      previousPublicKeyFingerprint: retired.fingerprint,
      previousPublicKeyExpiresAt: new Date(now.getTime() + 60_000),
    });

    // A runner switches keys only once the control plane acknowledges, so a lost
    // acknowledgement must leave it on a key that still works.
    expect(subject.keysValidAt(now)).toContain(retired.base64);
  });

  it('drops a retired key once its window has closed', () => {
    const retired = key();
    const subject = host({
      previousPublicKey: retired.base64,
      previousPublicKeyFingerprint: retired.fingerprint,
      previousPublicKeyExpiresAt: new Date(now.getTime() - 1),
    });

    expect(subject.keysValidAt(now)).not.toContain(retired.base64);
    // Never zero keys: the current one is not part of the window.
    expect(subject.keysValidAt(now)).toHaveLength(1);
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
});

describe('invariants', () => {
  it('refuses a fingerprint that is not a SHA-256 digest', () => {
    expect(() => host({ publicKeyFingerprint: 'abc' })).toThrow();
  });

  it('refuses a retired key with no end to its window', () => {
    // Either it is valid for ever or it is dropped at the next boot, and both
    // leave a running runner unrecoverable.
    const retired = key();
    expect(() =>
      host({
        previousPublicKey: retired.base64,
        previousPublicKeyFingerprint: retired.fingerprint,
        previousPublicKeyExpiresAt: null,
      }),
    ).toThrow();
  });

  it('refuses a host with no owner', () => {
    expect(() => host({ ownerUserId: '' })).toThrow();
  });

  it('refuses an empty name, on create and on rename', () => {
    expect(() => host({ name: '' })).toThrow();
    expect(() => host().rename('  ')).toThrow();
  });
});
