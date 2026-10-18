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
const stored = (provider: 'glm' | 'openai', keyHint: string, markedDefault = false) =>
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
      markedDefault,
    },
  });

describe('ModelProviderCredentialMapper.toResponseList', () => {
  const mapper = new ModelProviderCredentialMapper();

  it('lists every provider in catalog order, stored keys by hint alone, the rest as missing', () => {
    const list = mapper.toResponseList([stored('openai', '9f3a'), stored('glm', '12ab')]);
    expect(list.map((row) => row.provider)).toEqual([...BOT_PROVIDERS]);
    expect(list).toEqual([
      {
        provider: 'anthropic',
        configured: false,
        keyHint: null,
        updatedAt: null,
        isDefault: false,
      },
      {
        provider: 'glm',
        configured: true,
        keyHint: '12ab',
        updatedAt: updatedAt.toISOString(),
        isDefault: false,
      },
      {
        provider: 'openai',
        configured: true,
        keyHint: '9f3a',
        updatedAt: updatedAt.toISOString(),
        isDefault: true,
      },
      { provider: 'chatgpt', configured: false, keyHint: null, updatedAt: null, isDefault: false },
    ]);
  });

  it('says exactly one provider is the default, Anthropic when no key is stored', () => {
    expect(mapper.toResponseList([]).filter((row) => row.isDefault)).toMatchObject([
      { provider: 'anthropic' },
    ]);
    const list = mapper.toResponseList([stored('openai', '9f3a'), stored('glm', '12ab', true)]);
    expect(list.filter((row) => row.isDefault)).toMatchObject([{ provider: 'glm' }]);
  });
});
