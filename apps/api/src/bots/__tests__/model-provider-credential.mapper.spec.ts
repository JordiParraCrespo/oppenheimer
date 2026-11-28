import { randomUUID } from 'node:crypto';
import { MODEL_PROVIDERS } from '@oppenheimer/shared';
import { ModelProviderCredentialEntity } from '../domain/model-provider-credential.entity';
import { ModelProviderCredentialMapper } from '../model-provider-credential.mapper';

/**
 * Settings → Model providers lists every provider, whatever the workspace has
 * stored. What breaks if this regresses: a provider with no key vanishes from
 * the screen (nothing to add it from), the order jumps around, or the sealed
 * key reaches the response.
 */
const updatedAt = new Date('2026-10-01T09:30:00.000Z');
const stored = (
  provider: 'glm' | 'openai' | 'groq',
  keyHint: string,
  markedDefault = false,
  extra: { position?: number; spentAt?: Date | null; createdAt?: Date } = {},
) =>
  ModelProviderCredentialEntity.create({
    id: randomUUID(),
    createdAt: extra.createdAt ?? updatedAt,
    updatedAt,
    props: {
      organizationId: randomUUID(),
      provider,
      sealedKey: Buffer.from('sealed-bytes'),
      keyHint,
      updatedByUserId: randomUUID(),
      markedDefault,
      position: extra.position ?? 0,
      spentAt: extra.spentAt ?? null,
    },
  });

describe('ModelProviderCredentialMapper.toResponseList', () => {
  const mapper = new ModelProviderCredentialMapper();

  it('lists every provider in catalog order, stored keys by hint alone, the rest as missing', () => {
    const list = mapper.toResponseList([stored('openai', '9f3a'), stored('glm', '12ab')]);
    expect(list.map((row) => row.provider)).toEqual([...MODEL_PROVIDERS]);
    expect(list).toEqual([
      {
        provider: 'anthropic',
        configured: false,
        keyHint: null,
        updatedAt: null,
        isDefault: false,
        keys: [],
      },
      {
        provider: 'glm',
        configured: true,
        keyHint: '12ab',
        updatedAt: updatedAt.toISOString(),
        isDefault: false,
        keys: [
          {
            id: expect.any(String),
            keyHint: '12ab',
            spentAt: null,
            updatedAt: updatedAt.toISOString(),
          },
        ],
      },
      {
        provider: 'openai',
        configured: true,
        keyHint: '9f3a',
        updatedAt: updatedAt.toISOString(),
        isDefault: true,
        keys: [
          {
            id: expect.any(String),
            keyHint: '9f3a',
            spentAt: null,
            updatedAt: updatedAt.toISOString(),
          },
        ],
      },
      {
        provider: 'chatgpt',
        configured: false,
        keyHint: null,
        updatedAt: null,
        isDefault: false,
        keys: [],
      },
      {
        provider: 'xai',
        configured: false,
        keyHint: null,
        updatedAt: null,
        isDefault: false,
        keys: [],
      },
      {
        provider: 'groq',
        configured: false,
        keyHint: null,
        updatedAt: null,
        isDefault: false,
        keys: [],
      },
      {
        provider: 'elevenlabs',
        configured: false,
        keyHint: null,
        updatedAt: null,
        isDefault: false,
        keys: [],
      },
    ]);
  });

  it('says exactly one provider is the default, Anthropic when no key is stored', () => {
    expect(mapper.toResponseList([]).filter((row) => row.isDefault)).toMatchObject([
      { provider: 'anthropic' },
    ]);
    const list = mapper.toResponseList([stored('openai', '9f3a'), stored('glm', '12ab', true)]);
    expect(list.filter((row) => row.isDefault)).toMatchObject([{ provider: 'glm' }]);
  });

  // What breaks this: a workspace with only a Groq key gets new bots on Groq, which runs no bot.
  it('never makes a speech-only provider the default, marked or not', () => {
    const list = mapper.toResponseList([stored('groq', 'gq12', true)]);
    expect(list.filter((row) => row.isDefault)).toMatchObject([{ provider: 'anthropic' }]);
    expect(list.find((row) => row.provider === 'groq')).toMatchObject({ configured: true });
  });

  // What breaks this: a provider's second key replaces the first in the list, or the keys come back
  // in the order rows were read, so the console's "used first" is a key a call does not use first.
  it('lists every key of a provider in its stored order, each saying whether it is spent', () => {
    const spentAt = new Date('2026-11-01T12:00:00.000Z');
    const list = mapper.toResponseList([
      stored('glm', 'bbbb', false, { position: 1 }),
      stored('glm', 'aaaa', false, { position: 0, spentAt }),
    ]);
    expect(list.find((row) => row.provider === 'glm')).toMatchObject({
      configured: true,
      keyHint: 'aaaa',
      keys: [
        { keyHint: 'aaaa', spentAt: spentAt.toISOString() },
        { keyHint: 'bbbb', spentAt: null },
      ],
    });
  });
});
