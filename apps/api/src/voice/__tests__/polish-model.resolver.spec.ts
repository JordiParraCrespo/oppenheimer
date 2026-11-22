import { DEFAULT_VOICE_SETTINGS } from '@oppenheimer/shared';
import type { TurnCredentialsPort } from '../../bots/application/turn-credentials.port';
import { PolishModelResolver } from '../application/polish-model.resolver';

/**
 * Which model tidies a transcript, from the workspace's choice. What breaks
 * if this regresses: a polish turned off still rewrites the words, a chosen
 * model is ignored, or a removed key fails a dictation instead of falling
 * back to the rule from before there was a choice.
 */

const ORG = 'org-placeholder';
const NOW = new Date('2026-11-21T10:00:00Z');
const BROUGHT = { provider: 'chatgpt' as const, credential: { apiKey: 'access-placeholder' } };

function credentials(held: string[], opens = true): TurnCredentialsPort {
  return {
    has: vi.fn(async (_org, provider) => held.includes(provider)),
    forTurn: vi.fn(async () => {
      if (!opens) throw new Error('cannot open');
      return { apiKey: 'key-placeholder' };
    }),
  };
}

describe('PolishModelResolver', () => {
  it('polishes nothing when the workspace turned it off', async () => {
    const resolver = new PolishModelResolver(credentials(['anthropic']));
    await expect(
      resolver.targetFor(ORG, { polishProvider: 'off', polishModel: null }, BROUGHT, NOW),
    ).resolves.toEqual({ polish: false });
  });

  it("tidies on the chosen provider's credential and model", async () => {
    const resolver = new PolishModelResolver(credentials(['xai']));
    await expect(
      resolver.targetFor(ORG, { polishProvider: 'xai', polishModel: 'grok-4.6' }, BROUGHT, NOW),
    ).resolves.toEqual({
      polish: true,
      model: { provider: 'xai', credential: { apiKey: 'key-placeholder' }, model: 'grok-4.6' },
    });
  });

  it('keeps the automatic rule when nothing was chosen, the key is gone, or it will not open', async () => {
    const automatic = { polish: true, model: BROUGHT };
    await expect(
      new PolishModelResolver(credentials([])).targetFor(ORG, DEFAULT_VOICE_SETTINGS, BROUGHT, NOW),
    ).resolves.toEqual(automatic);
    await expect(
      new PolishModelResolver(credentials([])).targetFor(
        ORG,
        { polishProvider: 'anthropic', polishModel: null },
        BROUGHT,
        NOW,
      ),
    ).resolves.toEqual(automatic);
    await expect(
      new PolishModelResolver(credentials(['anthropic'], false)).targetFor(
        ORG,
        { polishProvider: 'anthropic', polishModel: null },
        BROUGHT,
        NOW,
      ),
    ).resolves.toEqual(automatic);
  });
});
