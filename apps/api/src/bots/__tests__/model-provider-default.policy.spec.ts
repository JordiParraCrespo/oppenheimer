import { randomUUID } from 'node:crypto';
import type { BotProvider } from '@oppenheimer/shared';
import { ModelProviderCredentialEntity } from '../domain/model-provider-credential.entity';
import { defaultBotProvider } from '../domain/model-provider-default.policy';

/**
 * The provider a new bot starts on. What breaks if this regresses: a workspace
 * with only an OpenAI key gets Anthropic bots that cannot answer, or the
 * provider a person marked is ignored.
 */
const key = (provider: BotProvider, storedAt: string, markedDefault = false) =>
  ModelProviderCredentialEntity.create({
    id: randomUUID(),
    createdAt: new Date(storedAt),
    updatedAt: new Date(storedAt),
    props: {
      organizationId: randomUUID(),
      provider,
      sealedKey: Buffer.from('sealed'),
      keyHint: 'abcd',
      updatedByUserId: null,
      markedDefault,
    },
  });

describe('defaultBotProvider', () => {
  it('is the provider the workspace marked, whenever its key was stored', () => {
    expect(
      defaultBotProvider([
        key('openai', '2026-10-01T00:00:00Z'),
        key('glm', '2026-10-03T00:00:00Z', true),
      ]),
    ).toBe('glm');
  });

  it('is Anthropic when none is marked and Anthropic has a key, whichever was stored first', () => {
    expect(
      defaultBotProvider([
        key('openai', '2026-10-01T00:00:00Z'),
        key('anthropic', '2026-10-02T00:00:00Z'),
      ]),
    ).toBe('anthropic');
  });

  it('is a provider with a key when none is marked and Anthropic has none', () => {
    expect(defaultBotProvider([key('openai', '2026-10-01T00:00:00Z')])).toBe('openai');
  });

  it('is Anthropic for a workspace with no key', () => {
    expect(defaultBotProvider([])).toBe('anthropic');
  });
});
