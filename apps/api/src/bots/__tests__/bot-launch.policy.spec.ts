import { type BotEngine, type BotEngineEdit, resolveBotEngine } from '../domain/bot-launch.policy';

/**
 * A bot's provider, model and effort after an edit (`product/versions/mvp/25-bots.md`
 * §1): always a tuple the catalog offers. The entity's spec covers that an
 * edit applies it; this is the whole rule.
 */
const opusHigh: BotEngine = { provider: 'anthropic', model: 'claude-opus-5-5', effort: 'high' };
const defaults: BotEngine = { provider: 'anthropic', model: null, effort: null };

describe('resolveBotEngine', () => {
  it.each<[string, BotEngine, BotEngineEdit, BotEngine]>([
    ['an empty edit keeps the engine', opusHigh, {}, opusHigh],
    ['the same provider keeps model and effort', opusHigh, { provider: 'anthropic' }, opusHigh],
    [
      'a new provider alone runs its default model at its default effort',
      opusHigh,
      { provider: 'openai' },
      { provider: 'openai', model: null, effort: null },
    ],
    [
      'a new provider takes a model and effort named with it',
      opusHigh,
      { provider: 'openai', model: 'gpt-5.6-terra', effort: 'ultra' },
      { provider: 'openai', model: 'gpt-5.6-terra', effort: 'ultra' },
    ],
    [
      'a new provider with an effort only checks it against its default model',
      defaults,
      { provider: 'glm', effort: 'low' },
      { provider: 'glm', model: null, effort: 'low' },
    ],
    [
      'a new model keeps an effort it offers',
      opusHigh,
      { model: 'claude-sonnet-5-5' },
      { provider: 'anthropic', model: 'claude-sonnet-5-5', effort: 'high' },
    ],
    [
      'a new model drops an effort it does not offer',
      opusHigh,
      { model: 'claude-haiku-4-5' },
      { provider: 'anthropic', model: 'claude-haiku-4-5', effort: null },
    ],
    [
      'a null model is the provider default, which keeps an effort it offers',
      opusHigh,
      { model: null },
      { provider: 'anthropic', model: null, effort: 'high' },
    ],
    [
      'an effort the model offers is recorded',
      defaults,
      { effort: 'max' },
      { provider: 'anthropic', model: null, effort: 'max' },
    ],
    [
      'an effort the model does not offer is none',
      opusHigh,
      { effort: 'ultra' },
      { provider: 'anthropic', model: 'claude-opus-5-5', effort: null },
    ],
    [
      'a null effort clears it',
      opusHigh,
      { effort: null },
      { provider: 'anthropic', model: 'claude-opus-5-5', effort: null },
    ],
  ])('%s', (_, current, edit, expected) => {
    expect(resolveBotEngine(current, edit)).toEqual(expected);
  });

  it('refuses a model the provider does not offer, on the same provider or a new one', () => {
    const refused = { code: 'GENERIC.ARGUMENT_INVALID' };
    expect(() => resolveBotEngine(defaults, { model: 'gpt-5.6-sol' })).toThrow(
      expect.objectContaining(refused),
    );
    expect(() => resolveBotEngine(opusHigh, { provider: 'glm' })).not.toThrow();
    expect(() => resolveBotEngine(opusHigh, { provider: 'glm', model: 'claude-opus-5-5' })).toThrow(
      expect.objectContaining(refused),
    );
  });
});
