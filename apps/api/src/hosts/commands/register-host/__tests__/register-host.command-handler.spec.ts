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

/** What the burn hands back about the row it claimed. */
const REDEEMED = {
  id: 'token-1',
  ownerUserId: 'jordi',
  intendedName: 'Dev box',
  redeemedHostId: 'host-new',
};

function token(
  overrides: Partial<Parameters<typeof HostPairingTokenEntity.create>[0]['props']> = {},
) {
  return HostPairingTokenEntity.create({
    id: 'token-1',
    props: {
      ownerUserId: 'jordi',
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
      lastSeenAt: null,
      unpairedAt: null,
    },
  });
}

/**
 * The document `apps/runner/internal/host/domain.Facts` marshals, field for
 * field — the shared schema takes the runner's struct verbatim, so a fixture
 * that drifts from it is a fixture that hides a 400.
 */
const FACTS = {
  platform: 'macos' as const,
  osVersion: '15.2',
  arch: 'arm64',
  hostname: 'devbox.local',
  user: 'jordi',
  home: '/Users/jordi',
  root: false,
  tools: [
    { name: 'git', path: '/usr/bin/git', version: '2.51.0', required: true },
    { name: 'tmux', path: '/opt/homebrew/bin/tmux', version: '3.5a', required: true },
    { name: 'claude', required: false },
  ],
  workspacePath: '/Users/jordi/oppenheimer-ai',
  diskFreeBytes: 214_748_364_800,
  runnerVersion: '0.3.1',
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
      // The adapter builds the host from the row its statement claimed, and hands
      // back what it inserted; the double does the same with a fixed row.
      redeemAndRegister: vi.fn(async ({ host }) => Some(host(REDEEMED))),
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
      // The id the redemption statement recorded, so the response names the row
      // that statement wrote.
      hostId: 'host-new',
      fingerprint: CONTROL_PLANE_FINGERPRINT,
      channel: 'stable',
      releaseBaseUrl: 'https://releases.example.com',
    });
  });

  it('adopts the name the token carried, not the one the runner detected', async () => {
    // The console names the machine before it exists, so nobody has to rename a
    // box that defaulted to its hostname.
    await handler.execute(command({ name: 'devbox.local' }));

    const [{ host }] = vi.mocked(hosts.redeemAndRegister).mock.calls[0];
    expect(host(REDEEMED).name).toBe('Dev box');
    // And the host belongs to whoever minted the token, not to whoever asked.
    expect(host(REDEEMED).ownerUserId).toBe('jordi');
  });

  it('records the machine’s facts, and the columns worth querying', async () => {
    await handler.execute(command());

    const [{ host }] = vi.mocked(hosts.redeemAndRegister).mock.calls[0];
    const registered = host(REDEEMED);

    expect(registered).toMatchObject({
      hostname: 'devbox.local',
      // The family the runner installs a service for, plus the release when it
      // determined one.
      os: 'macos 15.2',
      arch: 'arm64',
      runnerVersion: '0.3.1',
    });
    // The whole inventory as it arrived, tools included: an agent is a probed
    // tool, so there is no second list to keep in step.
    expect(registered.capabilities).toEqual(FACTS);
  });

  it('builds no aggregate for a token the burn refused', async () => {
    // The callback is the whole point: a forged token never constructs a host,
    // because the statement that decides it may be spent is what calls it.
    vi.mocked(hosts.redeemAndRegister).mockResolvedValue(None);
    vi.mocked(tokens.findOneByHash).mockResolvedValue(None);

    await expect(handler.execute(command())).rejects.toMatchObject({ code: 'HOSTS_003' });
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
    // One read, not two: the burn is the only thing that looks the token up
    // before deciding, and the second read below happens only on the retry path.
    vi.mocked(hosts.redeemAndRegister).mockResolvedValue(None);
    vi.mocked(tokens.findOneByHash).mockResolvedValue(None);

    await expect(handler.execute(command())).rejects.toMatchObject({ code: 'HOSTS_003' });
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
    expect(hosts.redeemAndRegister).not.toHaveBeenCalled();
  });
});
