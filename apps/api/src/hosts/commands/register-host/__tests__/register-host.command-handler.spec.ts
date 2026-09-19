import { generateKeyPairSync } from 'node:crypto';
import { None, Some } from 'oxide.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HostRepositoryPort } from '../../../database/host.repository.port';
import type { HostPairingTokenRepositoryPort } from '../../../database/host-pairing-token.repository.port';
import { HostEntity } from '../../../domain/host.entity';
import { HostPairingTokenEntity } from '../../../domain/host-pairing-token.entity';
import { hashPairingTokenSecret } from '../../../domain/pairing-token-secret.factory';
import { HostMapper } from '../../../host.mapper';
import { keyFingerprint } from '../../../infrastructure/host-assertion.util';
import type { RunnerReleaseConfig } from '../../../infrastructure/runner-release.config';
import { RegisterHostCommand } from '../register-host.command';
import { RegisterHostCommandHandler } from '../register-host.command-handler';

/**
 * Redemption, and the three ways it can end.
 *
 * The one worth the most attention is the middle one: a machine that never saw
 * the response retries, the burn claims nothing, and it must still be handed the
 * host it already created — proved by the key it presents, not by asking it.
 */

const SECRET = 'opr_reg_abcdefghijklmnopqrstuvwxyz012345';
const TOKEN_HASH = hashPairingTokenSecret(SECRET);
const CONTROL_PLANE_FINGERPRINT = 'c'.repeat(64);

function keypair() {
  const { publicKey } = generateKeyPairSync('ed25519');
  const base64 = publicKey.export({ format: 'der', type: 'spki' }).subarray(12).toString('base64');
  return { base64, fingerprint: keyFingerprint(base64) as string };
}

function token(
  overrides: Partial<Parameters<typeof HostPairingTokenEntity.create>[0]['props']> = {},
) {
  return HostPairingTokenEntity.create({
    id: 'token-1',
    props: {
      createdByUserId: 'jordi',
      intendedName: 'Dev box',
      prefix: 'opr_reg_abcdef',
      tokenHash: TOKEN_HASH,
      createdFromIp: '203.0.113.7',
      redeemedFromIp: null,
      expiresAt: new Date(Date.now() + 3_600_000),
      revokedAt: null,
      redeemedAt: null,
      redeemedHostId: null,
      ...overrides,
    },
  });
}

function existingHost(fingerprint: string, publicKey: string) {
  return HostEntity.create({
    id: 'host-existing',
    props: {
      ownerUserId: 'jordi',
      name: 'Dev box',
      hostname: null,
      os: null,
      arch: null,
      runnerVersion: null,
      capabilities: null,
      publicKey,
      publicKeyFingerprint: fingerprint,
      previousPublicKey: null,
      previousPublicKeyFingerprint: null,
      previousPublicKeyExpiresAt: null,
      lastSeenAt: null,
      unpairedAt: null,
    },
  });
}

const FACTS = {
  hostname: 'devbox.local',
  os: 'macos',
  arch: 'arm64',
  tools: { git: '2.51.0', tmux: '3.5a', claude: null },
  agents: [],
};

describe('RegisterHostCommandHandler', () => {
  let hosts: Pick<HostRepositoryPort, 'redeemAndRegister' | 'findOneByIdForMachine'>;
  let tokens: Pick<HostPairingTokenRepositoryPort, 'findOneByHash'>;
  /**
   * The release config's members are getters, so the double is a plain mutable
   * object: one test turns `isConfigured` off to assert the refusal.
   */
  let release: {
    isConfigured: boolean;
    controlPlaneFingerprint: string | null;
    channel: string;
    releaseBaseUrl: string | undefined;
  };
  let handler: RegisterHostCommandHandler;
  let key: ReturnType<typeof keypair>;

  beforeEach(() => {
    key = keypair();
    hosts = {
      // The adapter hands back the aggregate it inserted; the double does the same.
      redeemAndRegister: vi.fn(async ({ host }) => Some(host)),
      findOneByIdForMachine: vi.fn().mockResolvedValue(None),
    };
    tokens = { findOneByHash: vi.fn().mockResolvedValue(Some(token())) };
    release = {
      isConfigured: true,
      controlPlaneFingerprint: CONTROL_PLANE_FINGERPRINT,
      channel: 'stable',
      releaseBaseUrl: 'https://releases.example.com',
    };
    handler = new RegisterHostCommandHandler(
      hosts as HostRepositoryPort,
      tokens as HostPairingTokenRepositoryPort,
      new HostMapper(),
      release as RunnerReleaseConfig,
    );
  });

  const command = (overrides: Partial<ConstructorParameters<typeof RegisterHostCommand>[0]> = {}) =>
    new RegisterHostCommand({
      token: SECRET,
      name: 'whatever-the-runner-detected',
      publicKey: key.base64,
      facts: FACTS,
      redeemedFromIp: '198.51.100.4',
      ...overrides,
    });

  it('pairs the machine and answers what the runner pins', async () => {
    const result = await handler.execute(command());

    expect(result).toMatchObject({
      fingerprint: CONTROL_PLANE_FINGERPRINT,
      channel: 'stable',
      releaseBaseUrl: 'https://releases.example.com',
    });
    expect(result.hostId).toBeTruthy();
  });

  it('adopts the name the token carried, not the one the runner detected', async () => {
    // The console names the machine before it exists, so nobody has to rename a
    // box that defaulted to its hostname.
    await handler.execute(command({ name: 'devbox.local' }));

    const [{ host }] = vi.mocked(hosts.redeemAndRegister).mock.calls[0];
    expect(host.name).toBe('Dev box');
    // And the host belongs to whoever minted the token, not to whoever asked.
    expect(host.ownerUserId).toBe('jordi');
  });

  it('records the machine’s facts, and the columns worth querying', async () => {
    await handler.execute(command());

    const [{ host }] = vi.mocked(hosts.redeemAndRegister).mock.calls[0];
    expect(host).toMatchObject({ hostname: 'devbox.local', os: 'macos', arch: 'arm64' });
    expect(host.capabilities).toEqual(FACTS);
  });

  it('spends the token by digest, and never by the secret', async () => {
    await handler.execute(command());

    expect(hosts.redeemAndRegister).toHaveBeenCalledWith(
      expect.objectContaining({ tokenHash: TOKEN_HASH, redeemedFromIp: '198.51.100.4' }),
    );
  });

  describe('a retry after a lost response', () => {
    beforeEach(() => {
      // The burn claims nothing the second time: the row is already spent.
      vi.mocked(hosts.redeemAndRegister).mockResolvedValue(None);
      vi.mocked(tokens.findOneByHash).mockResolvedValue(
        Some(token({ redeemedAt: new Date(), redeemedHostId: 'host-existing' })),
      );
    });

    it('returns the host the first attempt created', async () => {
      vi.mocked(hosts.findOneByIdForMachine).mockResolvedValue(
        Some(existingHost(key.fingerprint, key.base64)),
      );

      // Proved by the key it presents, so a dropped answer never pairs a machine
      // twice and never needs a second token.
      await expect(handler.execute(command())).resolves.toMatchObject({ hostId: 'host-existing' });
    });

    it('refuses a different machine presenting the same spent token', async () => {
      const impostor = keypair();
      vi.mocked(hosts.findOneByIdForMachine).mockResolvedValue(
        Some(existingHost(impostor.fingerprint, impostor.base64)),
      );

      await expect(handler.execute(command())).rejects.toMatchObject({ code: 'HOSTS_003' });
    });
  });

  it('refuses a token that was revoked, used or expired with one answer', async () => {
    // The burn's WHERE is the authority — this handler cannot and does not tell
    // the three apart, which is the point.
    vi.mocked(hosts.redeemAndRegister).mockResolvedValue(None);
    vi.mocked(tokens.findOneByHash).mockResolvedValue(Some(token({ revokedAt: new Date() })));

    await expect(handler.execute(command())).rejects.toMatchObject({ code: 'HOSTS_003' });
  });

  it('refuses a token nobody ever minted', async () => {
    vi.mocked(tokens.findOneByHash).mockResolvedValue(None);

    await expect(handler.execute(command())).rejects.toMatchObject({ code: 'HOSTS_003' });
    expect(hosts.redeemAndRegister).not.toHaveBeenCalled();
  });

  it('refuses a public key that is not an Ed25519 key', async () => {
    await expect(
      handler.execute(command({ publicKey: Buffer.alloc(16).toString('base64') })),
    ).rejects.toMatchObject({ code: 'GENERIC.ARGUMENT_INVALID' });
  });

  it('says so when the deployment has no runner release', async () => {
    // Nothing for the runner to pin, and no artifact for it to update from.
    release.isConfigured = false;

    await expect(handler.execute(command())).rejects.toMatchObject({ code: 'HOSTS_004' });
    expect(tokens.findOneByHash).not.toHaveBeenCalled();
  });
});
