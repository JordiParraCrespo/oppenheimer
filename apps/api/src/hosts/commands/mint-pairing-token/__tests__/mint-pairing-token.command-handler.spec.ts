import type { ConfigService } from '@nestjs/config';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { None, Some } from 'oxide.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HostPairingTokenRepositoryPort } from '../../../database/host-pairing-token.repository.port';
import { HostPairingTokenEntity } from '../../../domain/host-pairing-token.entity';
import { hashPairingTokenSecret } from '../../../domain/pairing-token-secret.factory';
import type { RunnerReleaseConfig } from '../../../infrastructure/runner-release.config';
import { MintPairingTokenCommand } from '../mint-pairing-token.command';
import { MintPairingTokenCommandHandler } from '../mint-pairing-token.command-handler';

/** The pairing settings `hosts.config.ts` registers, at their defaults. */
const MAX_SPENDABLE_TOKENS = 5;
const configWith = (overrides: Record<string, number> = {}) => {
  const values: Record<string, number> = {
    'hosts.pairingTokenTtlSeconds': 3_600,
    'hosts.maxUnspentPairingTokens': MAX_SPENDABLE_TOKENS,
    ...overrides,
  };
  return {
    getOrThrow: (key: string) => {
      if (!(key in values)) throw new Error(`Missing config ${key}`);
      return values[key];
    },
  } as unknown as ConfigService;
};
const config = configWith();

describe('MintPairingTokenCommandHandler', () => {
  let tokens: Pick<HostPairingTokenRepositoryPort, 'insertWithinCap' | 'findOneById'>;
  /**
   * `isConfigured` is a getter on the real thing, so the double is a plain
   * mutable object: one test turns it off to assert the refusal.
   */
  let release: {
    isConfigured: boolean;
    installScriptSha256: string | null;
    installCommandFor: (secret: string) => string;
    agentPromptFor: (secret: string) => string;
  };
  let handler: MintPairingTokenCommandHandler;

  beforeEach(() => {
    tokens = {
      insertWithinCap: vi.fn().mockResolvedValue(true),
      findOneById: vi.fn().mockResolvedValue(None),
    };
    release = {
      isConfigured: true,
      installScriptSha256: 'ab'.repeat(32),
      installCommandFor: vi.fn((secret: string) => `curl … --token ${secret}`),
      agentPromptFor: vi.fn((secret: string) => `install it, token ${secret}`),
    };
    handler = new MintPairingTokenCommandHandler(
      tokens as HostPairingTokenRepositoryPort,
      release as RunnerReleaseConfig,
      config,
    );
  });

  const scope = {} as AccessScope;
  const command = (replaces?: string) =>
    new MintPairingTokenCommand({
      userId: 'jordi',
      scope,
      name: 'Dev box',
      createdFromIp: '203.0.113.7',
      replaces,
    });
  const inserted = () => vi.mocked(tokens.insertWithinCap).mock.calls[0][0];
  const fence = () => vi.mocked(tokens.insertWithinCap).mock.calls[0][1];

  it('leaves the cap to the write, and refuses when the write finds no room', async () => {
    vi.mocked(tokens.insertWithinCap).mockResolvedValueOnce(false);

    await expect(handler.execute(command())).rejects.toMatchObject({ code: 'HOSTS_006' });
    expect(fence().cap).toBe(MAX_SPENDABLE_TOKENS);
  });

  it('revokes the token it replaces inside the same write', async () => {
    const old = HostPairingTokenEntity.mint({
      ownerUserId: 'jordi',
      intendedName: 'Dev box',
      prefix: 'opr_reg_abcdef',
      tokenHash: 'cd'.repeat(32),
      createdFromIp: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
    vi.mocked(tokens.findOneById).mockResolvedValueOnce(Some(old));

    await handler.execute(command(old.id));

    expect(tokens.findOneById).toHaveBeenCalledWith(scope, old.id);
    expect(fence().replacing).toBe(old);
    expect(old.revokedAt).not.toBeNull();
  });

  it('mints nothing when the token it should replace is not the caller’s', async () => {
    await expect(handler.execute(command('someone-elses'))).rejects.toMatchObject({
      code: 'HOSTS_002',
    });
    expect(tokens.insertWithinCap).not.toHaveBeenCalled();
  });

  it('hands back the installer digest the deployment published', async () => {
    const result = await handler.execute(command());
    expect(result.installScriptSha256).toBe('ab'.repeat(32));
  });

  it('stores only the digest of the secret it hands back', async () => {
    const result = await handler.execute(command());

    const token = inserted();
    const secret = /--token (\S+)/.exec(result.installCommand)?.[1] as string;

    // The runner checks the prefix before spending a token, so a user who pasted
    // the wrong secret is told which one they pasted.
    expect(secret).toMatch(/^opr_reg_/);
    expect(token.tokenHash).toBe(hashPairingTokenSecret(secret));
    // Nothing anywhere holds the secret itself, so nothing can hand it out twice.
    expect(JSON.stringify(token)).not.toContain(secret);
  });

  it('shows a prefix that identifies the row without revealing it', async () => {
    await handler.execute(command());

    const token = inserted();
    expect(token.prefix).toMatch(/^opr_reg_.{6}$/);
  });

  it('records the intended name and where the mint came from', async () => {
    await handler.execute(command());

    const token = inserted();
    expect(token).toMatchObject({ intendedName: 'Dev box', createdFromIp: '203.0.113.7' });
    expect(token.ownerUserId).toBe('jordi');
  });

  it('honours a deployment’s own lifetime, in the expiry and in the refusal', async () => {
    handler = new MintPairingTokenCommandHandler(
      tokens as HostPairingTokenRepositoryPort,
      release as RunnerReleaseConfig,
      configWith({ 'hosts.pairingTokenTtlSeconds': 900 }),
    );
    const before = Date.now();
    await handler.execute(command());

    const minutes = (inserted().expiresAt.getTime() - before) / 60_000;
    expect(minutes).toBeGreaterThan(14.9);
    expect(minutes).toBeLessThanOrEqual(15.1);

    vi.mocked(tokens.insertWithinCap).mockResolvedValueOnce(false);
    await expect(handler.execute(command())).rejects.toMatchObject({
      code: 'HOSTS_006',
      detail: expect.stringContaining('15 minutes'),
    });
  });

  it('refuses to mint what nobody could spend', async () => {
    release.isConfigured = false;

    await expect(handler.execute(command())).rejects.toMatchObject({ code: 'HOSTS_004' });
    expect(tokens.insertWithinCap).not.toHaveBeenCalled();
  });
});
