import { generateKeyPairSync, type KeyObject, sign } from 'node:crypto';
import type { ConfigService } from '@nestjs/config';
import type { CacheService } from '@oppenheimer/backend-cache';
import { None, Some } from 'oxide.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HostRepositoryPort } from '../../database/host.repository.port';
import { HostEntity } from '../../domain/host.entity';
import { keyFingerprint } from '../../infrastructure/host-assertion.util';
import { HostAssertionResolver } from '../host-assertion.resolver';

/**
 * The host credential, end to end minus Redis and Postgres.
 *
 * Every case below is a way in which an assertion can be wrong, and all of them
 * have to produce the same `HOSTS_005`: the endpoint must not become a way of
 * finding out which check refused you.
 */

const CONTROL_PLANE = 'https://api.example.com';
const NOW = new Date('2026-09-19T12:00:00Z');

function keypair() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const base64 = publicKey.export({ format: 'der', type: 'spki' }).subarray(12).toString('base64');
  return { privateKey, base64, fingerprint: keyFingerprint(base64) as string };
}

const base64url = (value: string | Buffer) => Buffer.from(value).toString('base64url');

function assertion(privateKey: KeyObject, claims: Record<string, unknown>): string {
  const header = base64url(JSON.stringify({ alg: 'EdDSA', typ: 'JWT' }));
  const payload = base64url(JSON.stringify(claims));
  const signature = sign(null, Buffer.from(`${header}.${payload}`), privateKey);
  return `${header}.${payload}.${base64url(signature)}`;
}

/** The claims the runner signs on every dial (`NewBootClaims`). */
function bootClaims(hostId: string, overrides: Record<string, unknown> = {}) {
  return {
    iss: hostId,
    sub: hostId,
    aud: CONTROL_PLANE,
    jti: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
    iat: Math.floor(NOW.getTime() / 1000),
    exp: Math.floor(NOW.getTime() / 1000) + 300,
    ...overrides,
  };
}

function hostWith(props: {
  publicKey: string;
  publicKeyFingerprint: string;
  previousPublicKey?: string | null;
  previousPublicKeyFingerprint?: string | null;
  previousPublicKeyExpiresAt?: Date | null;
  unpairedAt?: Date | null;
}): HostEntity {
  return HostEntity.create({
    id: 'host-1',
    props: {
      ownerUserId: 'jordi',
      name: 'Dev box',
      hostname: null,
      os: null,
      arch: null,
      runnerVersion: null,
      capabilities: null,
      previousPublicKey: null,
      previousPublicKeyFingerprint: null,
      previousPublicKeyExpiresAt: null,
      lastSeenAt: null,
      unpairedAt: null,
      ...props,
    },
  });
}

describe('HostAssertionResolver', () => {
  let hosts: Pick<HostRepositoryPort, 'findOneByIdForMachine'>;
  let cache: Pick<CacheService, 'setIfAbsent'>;
  let resolver: HostAssertionResolver;
  let current: ReturnType<typeof keypair>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    current = keypair();
    hosts = {
      findOneByIdForMachine: vi.fn().mockResolvedValue(
        Some(
          hostWith({
            publicKey: current.base64,
            publicKeyFingerprint: current.fingerprint,
          }),
        ),
      ),
    };
    cache = { setIfAbsent: vi.fn().mockResolvedValue(true) };
    const configService = {
      get: (key: string) => (key === 'hosts.controlPlaneUrl' ? CONTROL_PLANE : undefined),
    } as unknown as ConfigService;

    resolver = new HostAssertionResolver(
      hosts as HostRepositoryPort,
      cache as CacheService,
      configService,
    );
  });

  const verify = (token: string) => resolver.verify(token);

  it('accepts an assertion the host signed', async () => {
    await expect(verify(assertion(current.privateKey, bootClaims('host-1')))).resolves.toEqual({
      hostId: 'host-1',
    });
  });

  it('burns the token id for the rest of its life', async () => {
    await verify(assertion(current.privateKey, bootClaims('host-1')));

    // The TTL is the token's own remaining lifetime plus the skew tolerated on
    // the expiry, so the marker outlives every window in which the token would
    // still be accepted.
    expect(cache.setIfAbsent).toHaveBeenCalledWith(
      expect.stringContaining('host-1'),
      expect.any(String),
      330,
    );
  });

  it('refuses a replay', async () => {
    // A captured assertion cannot read anything, but it could open a link and
    // append events to a session's log — which is the source of truth.
    vi.mocked(cache.setIfAbsent).mockResolvedValue(false);

    await expect(verify(assertion(current.privateKey, bootClaims('host-1')))).rejects.toMatchObject(
      {
        code: 'HOSTS_005',
      },
    );
  });

  it('refuses an assertion signed by another key', async () => {
    const stranger = keypair();

    await expect(
      verify(assertion(stranger.privateKey, bootClaims('host-1'))),
    ).rejects.toMatchObject({ code: 'HOSTS_005' });
    // Nothing is burned when the signature does not hold: a forged `jti` must not
    // be able to lock out the real one.
    expect(cache.setIfAbsent).not.toHaveBeenCalled();
  });

  it('refuses an expired assertion', async () => {
    const claims = bootClaims('host-1', { exp: Math.floor(NOW.getTime() / 1000) - 120 });

    await expect(verify(assertion(current.privateKey, claims))).rejects.toMatchObject({
      code: 'HOSTS_005',
    });
  });

  it('refuses one that claims to live longer than a boot token', async () => {
    // Accepting it would silently widen the replay window the burn is sized
    // against.
    const claims = bootClaims('host-1', { exp: Math.floor(NOW.getTime() / 1000) + 86_400 });

    await expect(verify(assertion(current.privateKey, claims))).rejects.toMatchObject({
      code: 'HOSTS_005',
    });
  });

  it('refuses one minted for another control plane', async () => {
    const claims = bootClaims('host-1', { aud: 'https://api.someone-else.com' });

    await expect(verify(assertion(current.privateKey, claims))).rejects.toMatchObject({
      code: 'HOSTS_005',
    });
  });

  it('ignores a trailing slash on the audience', async () => {
    // The runner stores whatever URL it registered with, and the two spellings
    // are the same deployment.
    const claims = bootClaims('host-1', { aud: `${CONTROL_PLANE}/` });

    await expect(verify(assertion(current.privateKey, claims))).resolves.toEqual({
      hostId: 'host-1',
    });
  });

  it('refuses one whose issuer and subject disagree', async () => {
    const claims = bootClaims('host-1', { iss: 'host-2' });

    await expect(verify(assertion(current.privateKey, claims))).rejects.toMatchObject({
      code: 'HOSTS_005',
    });
  });

  it('refuses one with no token id to burn', async () => {
    const { jti, ...claims } = bootClaims('host-1');
    void jti;

    await expect(verify(assertion(current.privateKey, claims))).rejects.toMatchObject({
      code: 'HOSTS_005',
    });
  });

  it('refuses an unknown host', async () => {
    vi.mocked(hosts.findOneByIdForMachine).mockResolvedValue(None);

    await expect(verify(assertion(current.privateKey, bootClaims('host-1')))).rejects.toMatchObject(
      {
        code: 'HOSTS_005',
      },
    );
  });

  it('refuses something that is not an assertion at all', async () => {
    await expect(verify('oppenheimer_pat_abc')).rejects.toMatchObject({ code: 'HOSTS_005' });
  });

  describe('a key being rotated out', () => {
    it('accepts the retired key while its window is open', async () => {
      const retired = keypair();
      vi.mocked(hosts.findOneByIdForMachine).mockResolvedValue(
        Some(
          hostWith({
            publicKey: current.base64,
            publicKeyFingerprint: current.fingerprint,
            previousPublicKey: retired.base64,
            previousPublicKeyFingerprint: retired.fingerprint,
            previousPublicKeyExpiresAt: new Date(NOW.getTime() + 60_000),
          }),
        ),
      );

      await expect(verify(assertion(retired.privateKey, bootClaims('host-1')))).resolves.toEqual({
        hostId: 'host-1',
      });
    });

    it('refuses it once the window has closed', async () => {
      const retired = keypair();
      vi.mocked(hosts.findOneByIdForMachine).mockResolvedValue(
        Some(
          hostWith({
            publicKey: current.base64,
            publicKeyFingerprint: current.fingerprint,
            previousPublicKey: retired.base64,
            previousPublicKeyFingerprint: retired.fingerprint,
            previousPublicKeyExpiresAt: new Date(NOW.getTime() - 1),
          }),
        ),
      );

      await expect(
        verify(assertion(retired.privateKey, bootClaims('host-1'))),
      ).rejects.toMatchObject({ code: 'HOSTS_005' });
    });
  });

  describe('a host that has been unpaired', () => {
    it('still proves who it is', async () => {
      // Verification is identity, not permission. Its own uninstall call has to be
      // able to say "I am gone" twice and get the same answer, so what a host may
      // *do* is `HostAccessPort`'s question.
      vi.mocked(hosts.findOneByIdForMachine).mockResolvedValue(
        Some(
          hostWith({
            publicKey: current.base64,
            publicKeyFingerprint: current.fingerprint,
            unpairedAt: new Date(NOW.getTime() - 60_000),
          }),
        ),
      );

      await expect(verify(assertion(current.privateKey, bootClaims('host-1')))).resolves.toEqual({
        hostId: 'host-1',
      });
    });
  });

  describe('recognises', () => {
    it('claims a compact EdDSA token and nothing else', () => {
      expect(resolver.recognises(assertion(current.privateKey, bootClaims('host-1')))).toBe(true);
      expect(resolver.recognises('oppenheimer_pat_abc')).toBe(false);
    });
  });
});
