import { type BotEngine, type BotEngineEdit, resolveBotEngine } from '../domain/bot-launch.policy';

/**
 * A bot's provider, model, effort and advisor after an edit: always a tuple
 * the catalog offers. The entity's spec covers that an edit applies it; this is
 * the whole rule.
 */
const opusHigh: BotEngine = {
  provider: 'anthropic',
  model: 'claude-opus-5-5',
  effort: 'high',
  advisorModel: null,
};
const defaults: BotEngine = {
  provider: 'anthropic',
  model: null,
  effort: null,
  advisorModel: null,
};

describe('resolveBotEngine', () => {
  it.each<[string, BotEngine, BotEngineEdit, BotEngine]>([
    ['an empty edit keeps the engine', opusHigh, {}, opusHigh],
    ['the same provider keeps model and effort', opusHigh, { provider: 'anthropic' }, opusHigh],
    [
      'a new provider alone runs its default model at its default effort',
      opusHigh,
      { provider: 'openai' },
      { provider: 'openai', model: null, effort: null, advisorModel: null },
    ],
    [
      'a new provider takes a model and effort named with it',
      opusHigh,
      { provider: 'openai', model: 'gpt-5.6-terra', effort: 'ultra', advisorModel: null },
      { provider: 'openai', model: 'gpt-5.6-terra', effort: 'ultra', advisorModel: null },
    ],
    [
      'a new provider with an effort only checks it against its default model',
      defaults,
      { provider: 'glm', effort: 'low' },
      { provider: 'glm', model: null, effort: 'low', advisorModel: null },
    ],
    [
      'a new model keeps an effort it offers',
      opusHigh,
      { model: 'claude-sonnet-5-5' },
      { provider: 'anthropic', model: 'claude-sonnet-5-5', effort: 'high', advisorModel: null },
    ],
    [
      'a new model drops an effort it does not offer',
      opusHigh,
      { model: 'claude-haiku-4-5' },
      { provider: 'anthropic', model: 'claude-haiku-4-5', effort: null, advisorModel: null },
    ],
    [
      'a null model is the provider default, which keeps an effort it offers',
      opusHigh,
      { model: null },
      { provider: 'anthropic', model: null, effort: 'high', advisorModel: null },
    ],
    [
      'an effort the model offers is recorded',
      defaults,
      { effort: 'max' },
      { provider: 'anthropic', model: null, effort: 'max', advisorModel: null },
    ],
    [
      'an effort the model does not offer is none',
      opusHigh,
      { effort: 'ultra' },
      { provider: 'anthropic', model: 'claude-opus-5-5', effort: null, advisorModel: null },
    ],
    [
      'a null effort clears it',
      opusHigh,
      { effort: null },
      { provider: 'anthropic', model: 'claude-opus-5-5', effort: null, advisorModel: null },
    ],
  ])('%s', (_, current, edit, expected) => {
    expect(resolveBotEngine(current, edit)).toEqual(expected);
  });

  // What breaks this: an advisor kept past a change to a model or provider
  // that does not take it, which Anthropic refuses with a 400 on every turn,
  // or one recorded that the model never listed.
  describe('the advisor', () => {
    const sonnet: BotEngine = {
      provider: 'anthropic',
      model: 'claude-sonnet-5-5',
      effort: null,
      advisorModel: 'claude-opus-5-5',
    };

    it.each<[string, BotEngine, BotEngineEdit, string | null]>([
      [
        'one the model lists is recorded',
        { ...sonnet, advisorModel: null },
        { advisorModel: 'claude-opus-5-5' },
        'claude-opus-5-5',
      ],
      [
        'one the model does not list is none',
        { ...sonnet, advisorModel: null },
        { advisorModel: 'claude-opus-4-8' },
        null,
      ],
      ['null turns it off', sonnet, { advisorModel: null }, null],
      ['an edit of the effort keeps it', sonnet, { effort: 'low' }, 'claude-opus-5-5'],
      [
        'a new model that takes it keeps it',
        sonnet,
        { model: 'claude-haiku-5-5' },
        'claude-opus-5-5',
      ],
      ['a new model that does not take it drops it', sonnet, { model: 'claude-fable-5-2' }, null],
      ['a new provider drops it', sonnet, { provider: 'glm' }, null],
      [
        'a provider with no advisors records none',
        defaults,
        { provider: 'openai', advisorModel: 'claude-opus-5-5' },
        null,
      ],
    ])('%s', (_, current, edit, advisorModel) => {
      expect(resolveBotEngine(current, edit).advisorModel).toBe(advisorModel);
    });
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
