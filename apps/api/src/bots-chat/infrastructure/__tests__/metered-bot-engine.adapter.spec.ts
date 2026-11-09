import { Test } from '@nestjs/testing';
import {
  BotEngine,
  type BotTurnRequest,
  FakeBotEngine,
  type FakeScriptEvent,
} from '@oppenheimer/backend-agents';
import {
  createMetricsProvider,
  METRICS_REGISTRY,
  MetricsModule,
  type Registry,
} from '@oppenheimer/backend-core';
import { describe, expect, it } from 'vitest';
import {
  BotEngineMetrics,
  INNER_BOT_ENGINE,
  MeteredBotEngine,
} from '../metered-bot-engine.adapter';

/**
 * The bots dashboard and alerts read these series: a run that is not
 * counted, a usage event added to the wrong token type, or a stream the
 * meter alters are each a regression nobody sees until a graph lies.
 */
async function metered(script: (request: BotTurnRequest) => FakeScriptEvent[]) {
  const moduleRef = await Test.createTestingModule({
    imports: [MetricsModule.forRoot({ defaultMetrics: false })],
    providers: [
      ...createMetricsProvider(BotEngineMetrics),
      { provide: INNER_BOT_ENGINE, useValue: new FakeBotEngine(script) },
      MeteredBotEngine,
    ],
  }).compile();
  const registry = moduleRef.get<Registry>(METRICS_REGISTRY);
  const value = async (name: string, labels: Record<string, string>) => {
    const metric = (await registry.getMetricsAsJSON()).find((m) => m.name === name);
    const sample = (metric?.values ?? []).find((v) =>
      Object.entries(labels).every(([key, want]) => v.labels[key] === want),
    );
    return sample?.value;
  };
  return { engine: moduleRef.get(MeteredBotEngine) as BotEngine, value };
}

function request(overrides: Partial<BotTurnRequest> = {}): BotTurnRequest {
  return {
    provider: 'anthropic',
    apiKey: 'sk-test-key',
    model: 'claude-test',
    systemPrompt: '',
    history: [],
    message: 'hi',
    tools: [],
    signal: new AbortController().signal,
    ...overrides,
  };
}

async function drain(engine: BotEngine, turn: BotTurnRequest) {
  const events = [];
  for await (const event of engine.run(turn)) events.push(event);
  return events;
}

describe('MeteredBotEngine', () => {
  it('passes the inner stream through unchanged and counts the turn, its tokens and its tools', async () => {
    const script: FakeScriptEvent[] = [
      { type: 'retrying', reason: 'rate_limit', delayMs: 100 },
      {
        type: 'tool.started',
        callId: 'c1',
        name: 'look',
        input: {},
        result: { output: 'nope', isError: true },
      },
      { type: 'text.done', text: 'done' },
      {
        type: 'usage',
        inputTokens: 1_000,
        outputTokens: 50,
        cacheReadTokens: 800,
        cacheWriteTokens: 100,
      },
    ];
    const { engine, value } = await metered(() => script);
    const plain = await drain(new FakeBotEngine(() => script), request());

    expect(await drain(engine, request())).toEqual(plain);

    const turn = { provider: 'anthropic', kind: 'turn' };
    expect(await value('bot_engine_runs_total', { ...turn, reason: 'completed' })).toBe(1);
    expect(await value('bot_engine_tokens_total', { ...turn, type: 'input' })).toBe(1_000);
    expect(await value('bot_engine_tokens_total', { ...turn, type: 'output' })).toBe(50);
    expect(await value('bot_engine_tokens_total', { ...turn, type: 'cache_read' })).toBe(800);
    expect(await value('bot_engine_tokens_total', { ...turn, type: 'cache_write' })).toBe(100);
    expect(
      await value('bot_engine_tool_calls_total', { provider: 'anthropic', result: 'error' }),
    ).toBe(1);
    expect(
      await value('bot_engine_retries_total', { provider: 'anthropic', reason: 'rate_limit' }),
    ).toBe(1);
    expect(await value('bot_engine_runs_active', turn)).toBe(0);
    expect(await value('bot_engine_run_duration_seconds', { ...turn, le: '+Inf' })).toBe(1);
  });

  it('counts a failed run under its failure, and a completion apart from turns', async () => {
    const { engine, value } = await metered(() => [
      { type: 'done', reason: 'failed', error: 'no', failure: 'credential' },
    ]);

    await engine.complete(request({ provider: 'openai' })).catch(() => undefined);

    const completion = { provider: 'openai', kind: 'completion' };
    expect(await value('bot_engine_runs_total', { ...completion, reason: 'failed' })).toBe(1);
    expect(await value('bot_engine_failures_total', { ...completion, failure: 'credential' })).toBe(
      1,
    );
    expect(
      await value('bot_engine_runs_total', { provider: 'openai', kind: 'turn', reason: 'failed' }),
    ).toBe(0);
  });

  it('counts a run its caller stopped reading as incomplete, and no longer active', async () => {
    const { engine, value } = await metered(() => [
      { type: 'text.done', text: 'one' },
      { type: 'text.done', text: 'two' },
    ]);

    for await (const _event of engine.run(request())) break;

    const turn = { provider: 'anthropic', kind: 'turn' };
    expect(await value('bot_engine_runs_total', { ...turn, reason: 'incomplete' })).toBe(1);
    expect(await value('bot_engine_runs_active', turn)).toBe(0);
  });
});
