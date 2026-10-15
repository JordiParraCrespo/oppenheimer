import { randomUUID } from 'node:crypto';
import type { CacheService } from '@oppenheimer/backend-cache';
import { None, Some } from 'oxide.ts';
import { ChatgptCredentialResolver } from '../application/chatgpt-credential.resolver';
import type { ModelProviderCredentialRepositoryPort } from '../database/model-provider-credential.repository.port';
import { ModelProviderCredentialEntity } from '../domain/model-provider-credential.entity';
import {
  type ChatgptAuthPort,
  ChatgptAuthRefusedError,
  type ChatgptTokens,
} from '../infrastructure/chatgpt-auth.port';
import type { ProviderKeySealerPort } from '../infrastructure/provider-key-sealer.port';
import { ModelProviderCredentialMapper } from '../model-provider-credential.mapper';

/**
 * A workspace's ChatGPT sign-in as a turn reads it: a fresh token is used as
 * stored; one about to lapse is refreshed and the new tokens written only over
 * the secret that was read; a refresh ChatGPT refuses removes the sign-in and
 * fails the turn with BOTS_013, unless a newer sign-in already replaced it.
 */
const organizationId = randomUUID();
const now = new Date('2026-10-15T12:00:00.000Z');
const mapper = new ModelProviderCredentialMapper();
const sealer: ProviderKeySealerPort = {
  isConfigured: () => true,
  seal: (plaintext) => Buffer.from(plaintext),
  open: (sealed) => sealed.toString(),
};

const tokensExpiringIn = (ms: number, tag = 'a'): ChatgptTokens => ({
  accessToken: `access-${tag}`,
  refreshToken: `refresh-${tag}`,
  expiresAt: new Date(now.getTime() + ms),
  accountId: `account-${tag}`,
});

const credentialOf = (tokens: ChatgptTokens) =>
  ModelProviderCredentialEntity.createNew({
    organizationId,
    provider: 'chatgpt',
    sealedKey: sealer.seal(mapper.toChatgptSecret(tokens)),
    keyHint: tokens.accountId.slice(-4),
    updatedByUserId: randomUUID(),
  });

function setup(stored: ChatgptTokens[], refresh: () => Promise<ChatgptTokens>, rotated = true) {
  const reads = stored.map(credentialOf);
  const credentials: Pick<
    ModelProviderCredentialRepositoryPort,
    'findForRun' | 'put' | 'rotateSecret' | 'deleteIfUnchanged'
  > = {
    findForRun: vi.fn(async () => {
      const next = reads.length > 1 ? reads.shift() : reads[0];
      return next ? Some(next) : None;
    }),
    put: vi.fn(),
    rotateSecret: vi.fn(async () => rotated),
    deleteIfUnchanged: vi.fn(async () => rotated),
  };
  const auth: Pick<ChatgptAuthPort, 'refresh'> = { refresh: vi.fn(refresh) };
  const cache: Pick<CacheService, 'setIfAbsent' | 'del'> = {
    setIfAbsent: vi.fn(async () => true),
    del: vi.fn(),
  };
  const resolver = new ChatgptCredentialResolver(
    auth as ChatgptAuthPort,
    sealer,
    credentials as ModelProviderCredentialRepositoryPort,
    mapper,
    cache as CacheService,
  );
  return { resolver, credentials, auth, cache };
}

describe('ChatgptCredentialResolver.accessFor', () => {
  it('uses a token with time left as it is stored, without refreshing', async () => {
    const { resolver, auth } = setup([tokensExpiringIn(60 * 60_000)], async () => {
      throw new Error('not called');
    });
    await expect(resolver.accessFor(organizationId, now)).resolves.toEqual({
      accessToken: 'access-a',
      accountId: 'account-a',
    });
    expect(auth.refresh).not.toHaveBeenCalled();
  });

  it('refreshes a token about to lapse and writes the new one over the secret it read', async () => {
    const fresh = tokensExpiringIn(10 * 24 * 60 * 60_000, 'b');
    const { resolver, auth, credentials, cache } = setup(
      [tokensExpiringIn(60_000)],
      async () => fresh,
    );
    await expect(resolver.accessFor(organizationId, now)).resolves.toEqual({
      accessToken: 'access-b',
      accountId: 'account-b',
    });
    expect(auth.refresh).toHaveBeenCalledWith('refresh-a');
    const [read, sealedKey, keyHint] = vi.mocked(credentials.rotateSecret).mock.calls[0];
    expect(mapper.chatgptTokensOf(sealer.open(read.sealedKey))?.refreshToken).toBe('refresh-a');
    expect(mapper.chatgptTokensOf(sealer.open(sealedKey))).toEqual(fresh);
    expect(keyHint).toBe('nt-b');
    expect(cache.del).toHaveBeenCalled();
  });

  it('runs on the sign-in that replaced it when its own rotation lost', async () => {
    const replaced = tokensExpiringIn(10 * 24 * 60 * 60_000, 'c');
    const { resolver } = setup(
      [tokensExpiringIn(60_000), replaced],
      async () => tokensExpiringIn(10 * 24 * 60 * 60_000, 'b'),
      false,
    );
    await expect(resolver.accessFor(organizationId, now)).resolves.toEqual({
      accessToken: 'access-c',
      accountId: 'account-c',
    });
  });

  it('removes a sign-in ChatGPT refuses to refresh and fails the turn with BOTS_013', async () => {
    const { resolver, credentials } = setup([tokensExpiringIn(60_000)], async () => {
      throw new ChatgptAuthRefusedError('/oauth/token answered 401');
    });
    await expect(resolver.accessFor(organizationId, now)).rejects.toMatchObject({
      code: 'BOTS_013',
    });
    expect(credentials.deleteIfUnchanged).toHaveBeenCalledTimes(1);
    expect(credentials.rotateSecret).not.toHaveBeenCalled();
  });

  it('keeps a failed refresh that was not a refusal from removing the sign-in', async () => {
    const { resolver, credentials } = setup([tokensExpiringIn(60_000)], async () => {
      throw new Error('socket hang up');
    });
    await expect(resolver.accessFor(organizationId, now)).rejects.toThrow('socket hang up');
    expect(credentials.deleteIfUnchanged).not.toHaveBeenCalled();
  });

  it('fails with BOTS_013 when the workspace has no ChatGPT sign-in', async () => {
    const { resolver } = setup([], async () => tokensExpiringIn(0));
    await expect(resolver.accessFor(organizationId, now)).rejects.toMatchObject({
      code: 'BOTS_013',
    });
  });
});
