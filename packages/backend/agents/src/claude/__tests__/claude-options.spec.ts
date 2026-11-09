/**
 * Model pinning in the Claude Code subprocess's environment: every variable
 * through which Claude Code picks a model on its own carries the bot's
 * model, and none comes from the API's environment. Which variables those
 * are is read from the Claude Code binary (see `MODEL_VARIABLES`); this
 * spec holds that the list is applied, not that it is complete. And the
 * engine's own tools: offered on a turn, none on a completion.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { describe, expect, it } from 'vitest';
import { type BotTurnRequest, compactionThreshold } from '../../bot-engine';
import {
  BUILT_IN_TOOLS,
  claudeEnv,
  claudeOptions,
  DISALLOWED_TOOLS,
  MODEL_VARIABLES,
  pinAllModels,
  scratchDirs,
} from '../claude-options';

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

  // What breaks this: a Claude turn compacting only near the model's whole
  // window (a million tokens on some), while the other engines fold at
  // compactionThreshold, now that a turn has no step limit to keep it small.
  it('has Claude Code compact at the same point as the other engines', () => {
    const env = claudeEnv(
      { provider: 'anthropic', apiKey: 'sk-placeholder', model: 'm', contextWindow: 1_000_000 },
      scratchDirs('/scratch'),
      {},
    );
    const window = Number(env.CLAUDE_CODE_AUTO_COMPACT_WINDOW);
    const percent = Number(env.CLAUDE_AUTOCOMPACT_PCT_OVERRIDE);
    expect((window * percent) / 100).toBe(compactionThreshold(1_000_000));
  });
});

describe('claudeOptions', () => {
  // What breaks this: a turn stopped mid-work at a step count, which is what
  // made bots stop after 20 steps (2026-11-09).
  it('sets no turn limit unless the request names one', () => {
    expect(options(base).maxTurns).toBeUndefined();
    expect(options({ ...base, maxSteps: 2 }).maxTurns).toBe(2);
  });

  const base: BotTurnRequest = {
    provider: 'glm',
    apiKey: 'key-placeholder',
    model: 'model-placeholder',
    systemPrompt: 'You are a bot.',
    history: [],
    message: 'Hi',
    tools: [],
    signal: new AbortController().signal,
    scratchDir: '/scratch',
  };
  const options = (request: BotTurnRequest) =>
    claudeOptions(request, scratchDirs('/scratch'), {} as McpServer, () => undefined);

  it('offers the engine its web search and to-do list on a turn', () => {
    expect(options(base)).toMatchObject({ tools: BUILT_IN_TOOLS, allowedTools: BUILT_IN_TOOLS });
  });

  it('offers no engine tool to a completion, and keeps the rest denied', () => {
    const completion = options({ ...base, engineTools: false });
    expect(completion.tools).toEqual([]);
    expect(completion.allowedTools).toEqual([]);
    expect(completion.disallowedTools).toEqual(DISALLOWED_TOOLS);
  });
});
