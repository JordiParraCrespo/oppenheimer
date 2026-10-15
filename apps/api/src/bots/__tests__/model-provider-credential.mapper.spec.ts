import { randomUUID } from 'node:crypto';
import { BOT_PROVIDERS } from '@oppenheimer/shared';
import { ModelProviderCredentialEntity } from '../domain/model-provider-credential.entity';
import { ModelProviderCredentialMapper } from '../model-provider-credential.mapper';

/**
 * Settings → Model providers lists every provider, whatever the workspace has
 * stored. What breaks if this regresses: a provider with no key vanishes from
 * the screen (nothing to add it from), the order jumps around, or the sealed
 * key reaches the response.
 */
const updatedAt = new Date('2026-10-01T09:30:00.000Z');
const stored = (provider: 'glm' | 'openai', keyHint: string) =>
  ModelProviderCredentialEntity.create({
    id: randomUUID(),
    createdAt: updatedAt,
    updatedAt,
    props: {
      organizationId: randomUUID(),
      provider,
      sealedKey: Buffer.from('sealed-bytes'),
      keyHint,
      updatedByUserId: randomUUID(),
    },
  });

describe('ModelProviderCredentialMapper.toResponseList', () => {
  const mapper = new ModelProviderCredentialMapper();

  it('lists every provider in catalog order, stored keys by hint alone, the rest as missing', () => {
    const list = mapper.toResponseList([stored('openai', '9f3a'), stored('glm', '12ab')]);
    expect(list.map((row) => row.provider)).toEqual([...BOT_PROVIDERS]);
    expect(list).toEqual([
      { provider: 'anthropic', configured: false, keyHint: null, updatedAt: null },
      { provider: 'glm', configured: true, keyHint: '12ab', updatedAt: updatedAt.toISOString() },
      { provider: 'openai', configured: true, keyHint: '9f3a', updatedAt: updatedAt.toISOString() },
      { provider: 'chatgpt', configured: false, keyHint: null, updatedAt: null },
    ]);
  });
});

describe('ModelProviderCredentialMapper, ChatGPT sign-ins', () => {
  const mapper = new ModelProviderCredentialMapper();
  const tokens = {
    accessToken: 'access-placeholder',
    refreshToken: 'refresh-placeholder',
    expiresAt: new Date('2026-10-20T08:00:00.000Z'),
    accountId: 'account-placeholder',
  };

  it('reads back the tokens it sealed, and refuses a secret that is not a sign-in', () => {
    expect(mapper.chatgptTokensOf(mapper.toChatgptSecret(tokens))).toEqual(tokens);
    expect(mapper.chatgptTokensOf('sk-a-plain-api-key')).toBeNull();
    expect(mapper.chatgptTokensOf(JSON.stringify({ ...tokens, accountId: '' }))).toBeNull();
  });

  it('reads back a sign-in in progress, and refuses one missing its workspace', () => {
    const flow = {
      deviceAuthId: 'device-placeholder',
      userCode: 'ABCD-1234',
      organizationId: randomUUID(),
      expiresAt: new Date('2026-10-15T12:15:00.000Z'),
    };
    expect(mapper.chatgptLoginFlowOf(mapper.toChatgptLoginFlow(flow))).toEqual(flow);
    const { organizationId: _, ...withoutWorkspace } = flow;
    expect(
      mapper.chatgptLoginFlowOf(JSON.stringify({ ...withoutWorkspace, expiresAt: 1 })),
    ).toBeNull();
  });
});
