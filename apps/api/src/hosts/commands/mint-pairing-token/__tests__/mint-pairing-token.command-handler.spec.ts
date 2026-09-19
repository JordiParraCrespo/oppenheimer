import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HostPairingTokenRepositoryPort } from '../../../database/host-pairing-token.repository.port';
import { hashPairingTokenSecret } from '../../../domain/pairing-token-secret.factory';
import type { RunnerReleaseConfig } from '../../../infrastructure/runner-release.config';
import { MintPairingTokenCommand } from '../mint-pairing-token.command';
import { MintPairingTokenCommandHandler } from '../mint-pairing-token.command-handler';

describe('MintPairingTokenCommandHandler', () => {
  let tokens: Pick<HostPairingTokenRepositoryPort, 'insert'>;
  /**
   * `isConfigured` is a getter on the real thing, so the double is a plain
   * mutable object: one test turns it off to assert the refusal.
   */
  let release: {
    isConfigured: boolean;
    installCommandFor: (secret: string) => string;
    agentPromptFor: (secret: string) => string;
  };
  let handler: MintPairingTokenCommandHandler;

  beforeEach(() => {
    tokens = { insert: vi.fn().mockResolvedValue(undefined) };
    release = {
      isConfigured: true,
      installCommandFor: vi.fn((secret: string) => `curl … --token ${secret}`),
      agentPromptFor: vi.fn((secret: string) => `install it, token ${secret}`),
    };
    handler = new MintPairingTokenCommandHandler(
      tokens as HostPairingTokenRepositoryPort,
      release as RunnerReleaseConfig,
    );
  });

  const command = () =>
    new MintPairingTokenCommand({ userId: 'jordi', name: 'Dev box', createdFromIp: '203.0.113.7' });

  it('stores only the digest of the secret it hands back', async () => {
    const result = await handler.execute(command());

    const [token] = vi.mocked(tokens.insert).mock.calls[0];
    const secret = /--token (\S+)/.exec(result.installCommand)?.[1] as string;

    expect(secret).toBeTruthy();
    expect(token.tokenHash).toBe(hashPairingTokenSecret(secret));
    // Nothing anywhere holds the secret itself, so nothing can hand it out twice.
    expect(JSON.stringify(token)).not.toContain(secret);
  });

  it('mints a secret the runner will recognise', async () => {
    const result = await handler.execute(command());

    // The runner checks the prefix before spending a token, so a user who pasted
    // the wrong secret is told which one they pasted.
    expect(result.installCommand).toContain('--token opr_reg_');
  });

  it('shows a prefix that identifies the row without revealing it', async () => {
    await handler.execute(command());

    const [token] = vi.mocked(tokens.insert).mock.calls[0];
    expect(token.prefix).toMatch(/^opr_reg_.{6}$/);
  });

  it('records the intended name and where the mint came from', async () => {
    await handler.execute(command());

    const [token] = vi.mocked(tokens.insert).mock.calls[0];
    expect(token).toMatchObject({ intendedName: 'Dev box', createdFromIp: '203.0.113.7' });
    expect(token.createdByUserId).toBe('jordi');
  });

  it('expires the token within the hour', async () => {
    await handler.execute(command());

    const [token] = vi.mocked(tokens.insert).mock.calls[0];
    const minutes = (token.expiresAt.getTime() - Date.now()) / 60_000;
    expect(minutes).toBeGreaterThan(55);
    expect(minutes).toBeLessThanOrEqual(60);
  });

  it('refuses to mint what nobody could spend', async () => {
    // With no runner release configured there is no install command, and a
    // credential that cannot be redeemed is worse than a clear refusal.
    release.isConfigured = false;

    await expect(handler.execute(command())).rejects.toMatchObject({ code: 'HOSTS_004' });
    expect(tokens.insert).not.toHaveBeenCalled();
  });
});
