/**
 * The fake the API's tests drive turns with: it replays a script, ends each
 * tool call the script makes (running the tool, or with a scripted result),
 * and holds to the same stream contract as the real engines (one `done`,
 * last; abort is `cancelled`; a throw is `failed`).
 * Also the factory's routing of a provider it does not know.
 */
import { describe, expect, it } from 'vitest';
import type { BotEngineEvent, BotEngineTool, BotTurnRequest } from '../bot-engine';
import { createBotEngine } from '../bot-engine.factory';
import { FakeBotEngine } from '../fake-bot-engine';

const KEY = 'sk-fake-secret-0123456789';

function request(overrides: Partial<BotTurnRequest> = {}): BotTurnRequest {
  return {
    provider: 'anthropic',
    apiKey: KEY,
    model: 'model-placeholder',
    systemPrompt: 'You are a bot.',
    history: [],
    message: 'Hello',
    tools: [],
    signal: new AbortController().signal,
    scratchDir: '/unused',
    ...overrides,
  };
}

async function collect(events: AsyncIterable<BotEngineEvent>): Promise<BotEngineEvent[]> {
  const out: BotEngineEvent[] = [];
  for await (const event of events) out.push(event);
  return out;
}

const remember: BotEngineTool = {
  name: 'remember',
  description: 'Stores a fact',
  inputSchema: { type: 'object', properties: { fact: { type: 'string' } } },
  run: async (input) => ({ content: `stored: ${(input as { fact: string }).fact}` }),
};

describe('FakeBotEngine', () => {
  it('replays the script it is given for the request', async () => {
    const engine = new FakeBotEngine((req) => [
      { type: 'text.done', text: `echo: ${req.message}` },
      { type: 'done', reason: 'completed' },
    ]);

    expect(await collect(engine.run(request({ message: 'hi' })))).toEqual([
      { type: 'text.done', text: 'echo: hi' },
      { type: 'done', reason: 'completed' },
    ]);
  });

  it('runs a tool the script calls and reports its real output', async () => {
    const engine = new FakeBotEngine(() => [
      { type: 'tool.started', callId: 'c1', name: 'remember', input: { fact: 'likes tea' } },
      { type: 'text.done', text: 'Noted.' },
    ]);

    expect(await collect(engine.run(request({ tools: [remember] })))).toEqual([
      { type: 'tool.started', callId: 'c1', name: 'remember', input: { fact: 'likes tea' } },
      {
        type: 'tool.finished',
        callId: 'c1',
        name: 'remember',
        output: 'stored: likes tea',
        isError: false,
      },
      { type: 'text.done', text: 'Noted.' },
      { type: 'done', reason: 'completed' },
    ]);
  });

  it('hands back what the tool said its call made, beside the output', async () => {
    const start: BotEngineTool = {
      name: 'start_session',
      description: '',
      inputSchema: {},
      run: async () => ({
        content: 'Started it.',
        data: { sessionId: 's-1', ignored: 7 } as never,
      }),
    };
    const engine = new FakeBotEngine(() => [
      { type: 'tool.started', callId: 'c1', name: 'start_session', input: {} },
    ]);

    expect(await collect(engine.run(request({ tools: [start] })))).toContainEqual({
      type: 'tool.finished',
      callId: 'c1',
      name: 'start_session',
      output: 'Started it.',
      isError: false,
      data: { sessionId: 's-1' },
    });
  });

  it('reports a scripted result instead of running the tool', async () => {
    let ran = false;
    const watched: BotEngineTool = {
      ...remember,
      run: async () => {
        ran = true;
        return { content: 'real' };
      },
    };
    const engine = new FakeBotEngine(() => [
      {
        type: 'tool.started',
        callId: 'c1',
        name: 'remember',
        input: {},
        result: { output: 'scripted', isError: true },
      },
      {
        type: 'tool.started',
        callId: 'c2',
        name: 'web_search',
        input: {},
        result: { output: 'hits' },
      },
    ]);

    expect(await collect(engine.run(request({ tools: [watched] })))).toEqual([
      { type: 'tool.started', callId: 'c1', name: 'remember', input: {} },
      { type: 'tool.finished', callId: 'c1', name: 'remember', output: 'scripted', isError: true },
      { type: 'tool.started', callId: 'c2', name: 'web_search', input: {} },
      { type: 'tool.finished', callId: 'c2', name: 'web_search', output: 'hits', isError: false },
      { type: 'done', reason: 'completed' },
    ]);
    expect(ran).toBe(false);
  });

  it('reports a call to a tool the request does not have as an error result', async () => {
    const engine = new FakeBotEngine(() => [
      { type: 'tool.started', callId: 'c1', name: 'missing', input: {} },
    ]);

    expect(await collect(engine.run(request({ tools: [remember] })))).toEqual([
      { type: 'tool.started', callId: 'c1', name: 'missing', input: {} },
      {
        type: 'tool.finished',
        callId: 'c1',
        name: 'missing',
        output: 'Unknown tool: missing',
        isError: true,
      },
      { type: 'done', reason: 'completed' },
    ]);
  });

  it('reports a tool that throws as an error result and carries on', async () => {
    const failing: BotEngineTool = {
      ...remember,
      run: async () => {
        throw new Error('database down');
      },
    };
    const engine = new FakeBotEngine(() => [
      { type: 'tool.started', callId: 'c1', name: 'remember', input: {} },
    ]);

    expect(await collect(engine.run(request({ tools: [failing] })))).toEqual([
      { type: 'tool.started', callId: 'c1', name: 'remember', input: {} },
      {
        type: 'tool.finished',
        callId: 'c1',
        name: 'remember',
        output: 'database down',
        isError: true,
      },
      { type: 'done', reason: 'completed' },
    ]);
  });

  it('stops at the first done', async () => {
    const engine = new FakeBotEngine(() => [
      { type: 'done', reason: 'max_steps' },
      { type: 'text.done', text: 'after the end' },
      { type: 'done', reason: 'completed' },
    ]);

    expect(await collect(engine.run(request()))).toEqual([{ type: 'done', reason: 'max_steps' }]);
  });

  it('ends a throwing script with failed, without the key', async () => {
    const engine = new FakeBotEngine(async function* () {
      yield { type: 'text.delta', text: 'Hi' } as const;
      throw new Error(`upstream refused ${KEY}`);
    });

    expect(await collect(engine.run(request()))).toEqual([
      { type: 'text.delta', text: 'Hi' },
      { type: 'done', reason: 'failed', error: 'upstream refused [redacted]', failure: 'other' },
    ]);
  });

  it('ends with cancelled as soon as the turn is aborted', async () => {
    const controller = new AbortController();
    const engine = new FakeBotEngine(async function* () {
      yield { type: 'text.delta', text: 'Hi' } as const;
      await new Promise(() => undefined);
    });

    const events: BotEngineEvent[] = [];
    for await (const event of engine.run(request({ signal: controller.signal }))) {
      events.push(event);
      controller.abort();
    }

    expect(events).toEqual([
      { type: 'text.delta', text: 'Hi' },
      { type: 'done', reason: 'cancelled' },
    ]);
  });

  it('ends a turn aborted before it starts with cancelled alone', async () => {
    const controller = new AbortController();
    controller.abort();
    let started = false;
    const engine = new FakeBotEngine(() => {
      started = true;
      return [];
    });

    expect(await collect(engine.run(request({ signal: controller.signal })))).toEqual([
      { type: 'done', reason: 'cancelled' },
    ]);
    expect(started).toBe(false);
  });
});

describe('createBotEngine', () => {
  it('ends a turn for a provider it does not know with failed', async () => {
    const events = await collect(createBotEngine().run(request({ provider: 'mistral' as never })));

    expect(events).toEqual([
      { type: 'done', reason: 'failed', error: 'Unknown provider: mistral', failure: 'other' },
    ]);
  });
});
