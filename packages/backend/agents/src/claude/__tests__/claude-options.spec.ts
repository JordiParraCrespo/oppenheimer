/**
 * Model pinning in the Claude Code subprocess's environment: every variable
 * through which Claude Code picks a model on its own carries the bot's
 * model, and none comes from the API's environment. Which variables those
 * are is read from the Claude Code binary (see `MODEL_VARIABLES`); this
 * spec holds that the list is applied, not that it is complete.
 */
import { describe, expect, it } from 'vitest';
import { claudeEnv, MODEL_VARIABLES, pinAllModels, scratchDirs } from '../claude-options';

describe('pinAllModels', () => {
  it('sets every model variable to the model and leaves the rest alone', () => {
    const env: Record<string, string> = { PATH: '/bin', ANTHROPIC_MODEL: 'other-model' };

    pinAllModels(env, 'model-placeholder');

    expect(env.PATH).toBe('/bin');
    for (const name of MODEL_VARIABLES) expect(env[name]).toBe('model-placeholder');
    expect(MODEL_VARIABLES).toEqual(
      expect.arrayContaining([
        'ANTHROPIC_MODEL',
        'ANTHROPIC_SMALL_FAST_MODEL',
        'ANTHROPIC_DEFAULT_HAIKU_MODEL',
        'CLAUDE_CODE_SUBAGENT_MODEL',
      ]),
    );
  });
});

describe('claudeEnv', () => {
  it("pins every model to the bot's, whatever the API's environment says", () => {
    const parent = Object.fromEntries(MODEL_VARIABLES.map((name) => [name, 'api-model']));

    const env = claudeEnv(
      { provider: 'anthropic', apiKey: 'sk-placeholder', model: 'model-placeholder' },
      scratchDirs('/scratch'),
      { ...parent, PATH: '/bin' },
    );

    for (const name of MODEL_VARIABLES) expect(env[name]).toBe('model-placeholder');
  });
});
