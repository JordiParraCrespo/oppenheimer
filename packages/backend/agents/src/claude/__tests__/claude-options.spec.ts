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
  claudeSystemPrompt,
  DEFER_TOOLS_ABOVE_CHARS,
  DISALLOWED_TOOLS,
  MODEL_VARIABLES,
  pinAllModels,
  scratchDirs,
} from '../claude-options';
import { TOOL_NAMES_NOTE } from '../claude-tool-server';

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

  // What breaks this: a bot with every area on sending ~39,000 tokens of
  // tool definitions on every turn (2026-11-23), or one whose tools are
  // deferred with no `ToolSearch` to find them (Claude Code then loads them
  // all), or tool search asked of an endpoint not known to serve it.
  it('lets Claude Code defer the tools that may wait, on Anthropic only, with its tool search', () => {
    // Big enough together to be worth a search (`DEFER_TOOLS_ABOVE_CHARS`).
    const tool = (name: string, deferrable?: boolean) => ({
      name,
      description: 'x'.repeat(DEFER_TOOLS_ABOVE_CHARS),
      inputSchema: {},
      run: async () => ({ content: '' }),
      ...(deferrable === undefined ? {} : { deferrable }),
    });
    const anthropic = { ...base, provider: 'anthropic' as const };
    const mixed = options({ ...anthropic, tools: [tool('remember'), tool('search_mail', true)] });
    expect(mixed.tools).toEqual([...BUILT_IN_TOOLS, 'ToolSearch']);
    expect(mixed.env?.ENABLE_TOOL_SEARCH).toBe('true');
    const small = { ...tool('search_mail', true), description: 'Searches mail.' };
    expect(options({ ...anthropic, tools: [small] }).env?.ENABLE_TOOL_SEARCH).toBe('false');
    for (const none of [
      { ...anthropic, tools: [tool('remember')] },
      { ...base, tools: [tool('search_mail', true)] },
      { ...anthropic, baseUrl: 'https://proxy.example', tools: [tool('search_mail', true)] },
    ]) {
      expect(options(none).tools).toEqual(BUILT_IN_TOOLS);
      expect(options(none).env?.ENABLE_TOOL_SEARCH).toBe('false');
    }
    expect(options({ ...anthropic, engineTools: false, tools: [tool('a', true)] }).tools).toEqual(
      [],
    );
  });

  // What breaks this: Anthropic's advisor tool declared to an endpoint that
  // does not serve it (z.ai, a proxy), whose turns would then fail, or a
  // completion's one round trip spent consulting it.
  it("names the advisor to Claude Code on Anthropic's own API only, and never on a completion", () => {
    const anthropic = {
      ...base,
      provider: 'anthropic' as const,
      advisorModel: 'advisor-placeholder',
    };
    expect(options(anthropic).settings).toEqual({ advisorModel: 'advisor-placeholder' });
    for (const none of [
      { ...base, advisorModel: 'advisor-placeholder' },
      { ...anthropic, baseUrl: 'https://proxy.example' },
      { ...anthropic, engineTools: false },
      { ...anthropic, advisorModel: null },
    ]) {
      expect(options(none).settings).toBeUndefined();
    }
  });

  it('offers no engine tool to a completion, and keeps the rest denied', () => {
    const completion = options({ ...base, engineTools: false });
    expect(completion.tools).toEqual([]);
    expect(completion.allowedTools).toEqual([]);
    expect(completion.disallowedTools).toEqual(DISALLOWED_TOOLS);
  });
});

// What breaks this: everything a bot reads names its tools bare
// (`send_to_session`) while Claude Code serves them as
// `mcp__oppenheimer__<name>`, so a call by the name it read was answered "No
// such tool" and ran nothing: about half of a bot eval's runs (2026-11-24).
// Rewriting the names into that text instead corrupted the person's words and
// the world's (`import React from "react"`), so the bot is told once.
describe('claudeSystemPrompt', () => {
  const tool = { name: 'send_to_session' };

  it('tells a bot with tools how to call them here, after its own prompt, word for word', () => {
    const prompt = claudeSystemPrompt({
      systemPrompt: 'Remember to react: import React from "react".',
      tools: [tool],
    });
    expect(prompt).toBe(`Remember to react: import React from "react".\n\n${TOOL_NAMES_NOTE}`);
    expect(TOOL_NAMES_NOTE).toContain('mcp__oppenheimer__send_to_session');
  });

  it('adds nothing to a turn with no tools', () => {
    expect(claudeSystemPrompt({ systemPrompt: 'You are a bot.', tools: [] })).toBe(
      'You are a bot.',
    );
  });
});
