import 'reflect-metadata';
import { credentialsGrantSchema } from '@oppenheimer/shared/protocol';
import { describe, expect, it, vi } from 'vitest';
import type { CredentialOwnerPort } from '../../auth/application/credential-owner.port';
import type { RepositoryAccessPort } from '../../github/application/repository-access.port';
import type { HostKeyPort } from '../../hosts/application/host-key.port';
import { seal } from '../../hosts/application/seal.util';
import type { RunnerLink } from '../../links/application/link-registry.port';
import type { SessionLookupPort } from '../../sessions/application/session-lookup.port';
import { CredentialsProcessor } from '../infrastructure/credentials.processor';

const HOST = 'd0c6e4f2-3041-4c5d-8e6f-70819203b4c5';
const USER = 'e1d7f5a3-4152-4d6e-9f70-8192a3b4c5d6';
const ASK = {
  type: 'credentials.token' as const,
  requestId: 'c9b5d3e1-2f30-4b4c-9d5e-6f708192a3b4',
  sessionId: 'b8a4c2d0-1e2f-4a3b-8c4d-5e6f7a8b9c0d',
  checkoutId: 'a7a3b1cf-0d1e-4f2a-9b3c-4d5e6f7a8b9c',
  githubRepoId: 42,
};
// A valid Ed25519 public key (the seed 0x01..0x20's).
const HOST_KEY = Buffer.from(
  '79b5562e8fe654f94078b112e8a98ba7901f853ae695bed7e0e3910bad049664',
  'hex',
).toString('base64');

const LIVE = {
  hostId: HOST,
  installationId: 'inst-1',
  githubRepoId: 42,
  live: true,
  createdByUserId: USER,
};

function harness(target: Awaited<ReturnType<SessionLookupPort['findCredentialTarget']>>) {
  const link = {
    hostId: HOST,
    runId: 'r',
    epoch: 1,
    send: vi.fn().mockReturnValue(true),
  } as unknown as RunnerLink;
  const sessions = {
    findAttachTarget: vi.fn(),
    findCredentialTarget: vi.fn().mockResolvedValue(target),
  } as unknown as SessionLookupPort;
  const repositories = {
    mintRepositoryToken: vi.fn().mockResolvedValue({
      token: 'ghs_minted',
      expiresAt: new Date('2026-09-22T13:00:00Z'),
      githubRepoId: 42,
    }),
  } as unknown as RepositoryAccessPort;
  // The hosts module's own sealing, so a grant is checked as sealed for real.
  const keys = {
    publicKeyOf: vi.fn().mockResolvedValue(HOST_KEY),
    sealFor: vi.fn(async (_hostId: string, plaintext: Uint8Array) =>
      seal(HOST_KEY, plaintext).toString('base64'),
    ),
  } as unknown as HostKeyPort;
  const owners = { findActiveOwner: vi.fn().mockResolvedValue({ id: USER }) };
  return {
    link,
    repositories,
    keys,
    owners,
    processor: new CredentialsProcessor(
      sessions,
      repositories,
      keys,
      owners as unknown as CredentialOwnerPort,
    ),
  };
}

describe('CredentialsProcessor', () => {
  it('mints live and answers a grant sealed to the host key', async () => {
    const h = harness(LIVE);
    await h.processor.onToken(h.link, ASK);
    expect(h.repositories.mintRepositoryToken).toHaveBeenCalledWith('inst-1', 42);
    const [message] = vi.mocked(h.link.send).mock.calls[0];
    const grant = credentialsGrantSchema.parse(message);
    expect(grant.requestId).toBe(ASK.requestId);
    expect(Buffer.from(grant.sealed, 'base64').byteLength).toBeGreaterThan(32 + 12 + 16);
    expect(grant.sealed).not.toContain('ghs_minted');
  });

  type Harness = ReturnType<typeof harness>;
  const asIs = (_h: Harness) => {};

  it.each([
    ['no such checkout', null, asIs, 'SESSIONS_001'],
    ['a checkout on another host', { ...LIVE, hostId: 'other' }, asIs, 'SESSIONS_001'],
    ['a checkout that is no longer live', { ...LIVE, live: false }, asIs, 'SESSIONS_001'],
    [
      "a repository that is not the checkout's",
      { ...LIVE, githubRepoId: 43 },
      asIs,
      'SESSIONS_001',
    ],
    // Banned or deactivated since the session started: the session's git
    // credential goes the way of every other credential they hold.
    [
      'a session whose owner may not act',
      LIVE,
      (h: Harness) => h.owners.findActiveOwner.mockResolvedValue(null),
      'TOKEN_003',
    ],
    [
      'a host whose key is unavailable',
      LIVE,
      (h: Harness) => vi.mocked(h.keys.publicKeyOf).mockResolvedValue(null),
      'HOSTS_001',
    ],
  ] as const)('refuses %s without minting', async (_case, target, arrange, code) => {
    const h = harness(target);
    arrange(h);

    await h.processor.onToken(h.link, ASK);

    expect(h.repositories.mintRepositoryToken).not.toHaveBeenCalled();
    expect(h.link.send).toHaveBeenCalledTimes(1);
    expect(h.link.send).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'command.failed', commandId: ASK.requestId, code }),
    );
  });

  it.each([
    [
      'its catalog code',
      Object.assign(new Error('suspended'), { code: 'GITHUB_003' }),
      'GITHUB_003',
    ],
    ['GITHUB_002 when it carries none', new Error('socket hang up'), 'GITHUB_002'],
  ])('turns a refused mint into a command.failed with %s', async (_case, error, code) => {
    const h = harness(LIVE);
    vi.mocked(h.repositories.mintRepositoryToken).mockRejectedValueOnce(error);
    await h.processor.onToken(h.link, ASK);
    expect(h.link.send).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'command.failed', commandId: ASK.requestId, code }),
    );
  });
});
