/**
 * The OpenAI engine's translation of the Agents SDK's stream events into
 * the engine's events, and what it hands the SDK: key and base URL,
 * instructions, history as input items, tools, effort and the step limit.
 * The SDK module is mocked: its runner streams a script that calls our
 * tools the way the SDK would. `openai-responses.spec.ts` runs the real SDK.
 */
import { describe, expect, it, vi } from 'vitest';
import type { BotEngineEvent, BotEngineTool, BotTurnRequest } from '../../bot-engine';
import { OpenAiBotEngine } from '../openai-bot-engine';
import type { OpenAiStreamEvent } from '../openai-events';
import { XaiBotEngine } from '../xai-bot-engine';

/** A tool as the mocked `tool()` keeps it: the options the adapter passed. */
interface ToolOptions {
  name: string;
  description: string;
  parameters: unknown;
  strict: boolean;
  execute(
    input: unknown,
    context: unknown,
    details: { toolCall: { callId: string } },
  ): Promise<string>;
}

/** What the adapter handed the SDK for one run. */
interface Seen {
  provider: { apiKey?: string; baseURL?: string };
  runner: { tracingDisabled?: boolean };
  agent: {
    instructions: string;
    model: string;
    tools: ToolOptions[];
    modelSettings: { reasoning?: { effort?: string } };
  };
  input: unknown;
  options: { stream: boolean; signal: AbortSignal; maxTurns: number };
}

const sdk = vi.hoisted(() => {
  const state: {
    run?: (seen: Seen) => { events: AsyncIterable<unknown>; error: unknown };
    seen?: Seen;
  } = {};
  class OpenAIProvider {
    constructor(readonly options: Seen['provider']) {}
  }
  class Agent {
    constructor(readonly config: Seen['agent']) {}
  }
  class Runner {
    constructor(readonly options: Seen['runner'] & { modelProvider: OpenAIProvider }) {}
    async run(agent: Agent, input: unknown, options: Seen['options']) {
      const seen: Seen = {
        provider: this.options.modelProvider.options,
        runner: this.options,
        agent: agent.config,
        input,
        options,
      };
      state.seen = seen;
      const script = state.run?.(seen);
      if (!script) throw new Error('No script');
      return {
        [Symbol.asyncIterator]: () => script.events[Symbol.asyncIterator](),
        completed: Promise.resolve(),
        error: script.error,
      };
    }
  }
  const tool = (options: unknown) => options;
  return { state, module: { OpenAIProvider, Agent, Runner, tool } };
});
vi.mock('@openai/agents', () => sdk.module);

const KEY = 'sk-openai-secret-0123456789';

function request(overrides: Partial<BotTurnRequest> = {}): BotTurnRequest {
  return {
    provider: 'openai',
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

/**
 * Makes the SDK's runner stream what `script` yields, given what the
 * adapter handed it; `error` is how the run ended. Returns what it saw.
 */
function scripted(
  script: (seen: Seen) => AsyncGenerator<OpenAiStreamEvent>,
  error: unknown = null,
): { readonly seen: Seen | undefined } {
  sdk.state.seen = undefined;
  sdk.state.run = (seen) => ({ events: script(seen), error });
  return {
    get seen() {
      return sdk.state.seen;
    },
  };
}

/** Calls a tool the way the SDK does. */
const execute = (tool: ToolOptions, input: unknown, callId: string) =>
  tool.execute(input, {}, { toolCall: { callId } });

const textDelta = (delta: string): OpenAiStreamEvent => ({
  type: 'raw_model_stream_event',
  data: { type: 'output_text_delta', delta },
});
const responseDone = (inputTokens: number, outputTokens: number): OpenAiStreamEvent => ({
  type: 'raw_model_stream_event',
  data: { type: 'response_done', response: { usage: { inputTokens, outputTokens } } },
});
const message = (text: string): OpenAiStreamEvent => ({
  type: 'run_item_stream_event',
  name: 'message_output_created',
  item: {
    type: 'message_output_item',
    rawItem: { role: 'assistant', content: [{ type: 'output_text', text }] },
  },
});
const toolCalled = (callId: string, name: string, args: string): OpenAiStreamEvent => ({
  type: 'run_item_stream_event',
  name: 'tool_called',
  item: {
    type: 'tool_call_item',
    rawItem: { type: 'function_call', callId, name, arguments: args },
  },
});
const toolOutput = (callId: string, name: string, output: string): OpenAiStreamEvent => ({
  type: 'run_item_stream_event',
  name: 'tool_output',
  item: {
    type: 'tool_call_output_item',
    rawItem: { type: 'function_call_result', callId, name },
    output,
  },
});

describe('OpenAiBotEngine', () => {
  it('streams text, reports each message, summed usage and a completed end', async () => {
    scripted(async function* () {
      yield textDelta('Hel');
      yield textDelta('lo');
      yield responseDone(10, 2);
      yield message('Hello');
      yield responseDone(4, 1);
    });

    const events = await collect(new OpenAiBotEngine().run(request()));

    expect(events).toEqual([
      { type: 'text.delta', text: 'Hel' },
      { type: 'text.delta', text: 'lo' },
      { type: 'text.done', text: 'Hello' },
      { type: 'usage', inputTokens: 14, outputTokens: 3, context: { tokens: 4, window: null } },
      { type: 'done', reason: 'completed' },
    ]);
  });

  it('runs our tools, and reports a thrown error as a failed call, key redacted, that the model reads', async () => {
    const getTime: BotEngineTool = {
      name: 'get_time',
      description: 'The time',
      inputSchema: { type: 'object', properties: { zone: { type: 'string' } } },
      run: async (input) => ({ content: `12:00 in ${(input as { zone: string }).zone}` }),
    };
    const broken: BotEngineTool = {
      name: 'broken',
      description: 'Always throws',
      inputSchema: { type: 'object', properties: {} },
      run: async () => {
        throw new Error(`upstream refused ${KEY}`);
      },
    };
    let modelRead: string | undefined;
    const run = scripted(async function* (seen) {
      // What the SDK does with a function call: parse, execute, report.
      const [time, fail] = seen.agent.tools;
      yield toolCalled('call_1', 'get_time', '{"zone":"UTC"}');
      yield toolOutput('call_1', 'get_time', await execute(time, { zone: 'UTC' }, 'call_1'));
      yield toolCalled('call_2', 'broken', '{}');
      modelRead = await execute(fail, {}, 'call_2');
      yield toolOutput('call_2', 'broken', modelRead);
      yield message('Done');
    });

    const events = await collect(new OpenAiBotEngine().run(request({ tools: [getTime, broken] })));

    expect(
      run.seen?.agent.tools.map(({ name, description, parameters, strict }) => ({
        name,
        description,
        parameters,
        strict,
      })),
    ).toEqual([
      {
        name: 'get_time',
        description: 'The time',
        parameters: getTime.inputSchema,
        strict: false,
      },
      {
        name: 'broken',
        description: 'Always throws',
        parameters: broken.inputSchema,
        strict: false,
      },
    ]);
    expect(modelRead).toBe('upstream refused [redacted]');
    expect(events.filter((event) => event.type.startsWith('tool.'))).toEqual([
      { type: 'tool.started', callId: 'call_1', name: 'get_time', input: { zone: 'UTC' } },
      {
        type: 'tool.finished',
        callId: 'call_1',
        name: 'get_time',
        output: '12:00 in UTC',
        isError: false,
      },
      { type: 'tool.started', callId: 'call_2', name: 'broken', input: {} },
      {
        type: 'tool.finished',
        callId: 'call_2',
        name: 'broken',
        output: 'upstream refused [redacted]',
        isError: true,
      },
    ]);
    expect(events.at(-1)).toEqual({ type: 'done', reason: 'completed' });
  });

  it('hands back what a call made on its own end, never to the model', async () => {
    const start: BotEngineTool = {
      name: 'start_session',
      description: 'Starts a session',
      inputSchema: { type: 'object', properties: {} },
      run: async () => ({ content: 'Started it.', data: { sessionId: 's-1' } }),
    };
    let modelRead: string | undefined;
    scripted(async function* (seen) {
      const [tool] = seen.agent.tools;
      yield toolCalled('call_1', 'start_session', '{}');
      modelRead = await execute(tool, {}, 'call_1');
      yield toolOutput('call_1', 'start_session', modelRead);
    });

    const events = await collect(new OpenAiBotEngine().run(request({ tools: [start] })));

    expect(modelRead).toBe('Started it.');
    expect(events.find((event) => event.type === 'tool.finished')).toEqual({
      type: 'tool.finished',
      callId: 'call_1',
      name: 'start_session',
      output: 'Started it.',
      isError: false,
      data: { sessionId: 's-1' },
    });
  });

  it('sends the key, endpoint, history as native input items, then this message', async () => {
    const run = scripted(async function* () {});

    await collect(
      new OpenAiBotEngine().run(
        request({
          history: [
            { role: 'user', text: 'My name is Ada.' },
            { role: 'assistant', text: 'Hi Ada.' },
          ],
          message: 'What is my name?',
          effort: 'xhigh',
          maxSteps: 4,
          baseUrl: 'https://example.test/v1',
        }),
      ),
    );

    expect(run.seen).toMatchObject({
      provider: { apiKey: KEY, baseURL: 'https://example.test/v1' },
      runner: { tracingDisabled: true },
      agent: {
        model: 'model-placeholder',
        instructions: 'You are a bot.',
        modelSettings: { reasoning: { effort: 'xhigh' } },
      },
      options: { stream: true, maxTurns: 4 },
      input: [
        { type: 'message', role: 'user', content: 'My name is Ada.' },
        {
          type: 'message',
          role: 'assistant',
          status: 'completed',
          content: [{ type: 'output_text', text: 'Hi Ada.' }],
        },
        { type: 'message', role: 'user', content: 'What is my name?' },
      ],
    });
  });

  it('sends this message’s images before its text, as data URLs, and leaves the history text', async () => {
    const run = scripted(async function* () {});

    await collect(
      new OpenAiBotEngine().run(
        request({
          message: 'What is in these?',
          images: [
            { mimeType: 'image/png', data: 'cG5n' },
            { mimeType: 'image/webp', data: 'd2VicA==' },
          ],
        }),
      ),
    );

    expect(run.seen.input).toEqual([
      {
        type: 'message',
        role: 'user',
        content: [
          { type: 'input_image', image: 'data:image/png;base64,cG5n' },
          { type: 'input_image', image: 'data:image/webp;base64,d2VicA==' },
          { type: 'input_text', text: 'What is in these?' },
        ],
      },
    ]);
  });

  it('ends with max_steps when the SDK stops at the turn limit', async () => {
    const maxTurns = Object.assign(new Error('Max turns (4) exceeded'), {
      name: 'MaxTurnsExceededError',
    });
    scripted(async function* () {}, maxTurns);

    const events = await collect(new OpenAiBotEngine().run(request()));

    expect(events).toEqual([{ type: 'done', reason: 'max_steps' }]);
  });

  it('fails without the key in the error when the run errors', async () => {
    scripted(async function* () {
      yield textDelta('Hi');
      throw new Error(`401 Incorrect API key provided: ${KEY}`);
    });

    const events = await collect(new OpenAiBotEngine().run(request()));

    const done = events.at(-1) as { type: string; reason: string; error: string };
    expect(done.reason).toBe('failed');
    expect(done.error).toContain('Incorrect API key provided');
    expect(done.error).not.toContain(KEY);
  });

  it('marks a 429 as a rate limit, with the reset its Retry-After gives', async () => {
    scripted(async function* () {
      yield textDelta('Hi');
      throw Object.assign(new Error('429 Rate limit reached'), {
        status: 429,
        headers: new Headers({ 'retry-after': '30' }),
      });
    });
    const before = Date.now();

    const events = await collect(new OpenAiBotEngine().run(request()));

    const done = events.at(-1) as { reason: string; rateLimit?: { resetAt: Date | null } };
    expect(done.reason).toBe('failed');
    expect(done.rateLimit?.resetAt?.getTime()).toBeGreaterThanOrEqual(before + 30_000);
  });

  it('leaves any other failure unmarked', async () => {
    scripted(async function* () {
      yield textDelta('Hi');
      throw Object.assign(new Error('500 server error'), { status: 500 });
    });

    const done = (await collect(new OpenAiBotEngine().run(request()))).at(-1);

    expect(done).toMatchObject({ type: 'done', reason: 'failed' });
    expect(done).not.toHaveProperty('rateLimit');
  });

  // The chat says whether sending it again can help (`lessons-from-grok-bot.md`
  // §9, row 4): a spent quota or a refused key never passes on a retry, and a
  // spent quota must not be waited out as a rate limit either.
  it.each([
    [401, undefined, 'credential'],
    [403, undefined, 'credential'],
    [402, undefined, 'usage_limit'],
    [429, 'insufficient_quota', 'usage_limit'],
    [400, undefined, 'refused'],
    [404, 'model_not_found', 'refused'],
    [503, undefined, 'unavailable'],
    [418, undefined, 'other'],
  ])('reads a %i (%s) as a %s failure', async (status, code, failure) => {
    scripted(async function* () {
      yield textDelta('Hi');
      throw Object.assign(new Error(`${status} refused`), { status, code });
    });

    const done = (await collect(new OpenAiBotEngine().run(request()))).at(-1);

    expect(done).toMatchObject({ type: 'done', reason: 'failed', failure });
    expect(done).not.toHaveProperty('rateLimit');
  });

  it('fails when the run cannot start', async () => {
    sdk.state.run = () => {
      throw new Error('connect ECONNREFUSED');
    };

    const events = await collect(new OpenAiBotEngine().run(request()));

    expect(events).toEqual([
      { type: 'done', reason: 'failed', error: 'connect ECONNREFUSED', failure: 'unavailable' },
    ]);
  });

  it('cancels promptly on abort and passes the signal to the SDK', async () => {
    const controller = new AbortController();
    const run = scripted(async function* () {
      yield textDelta('Thinking');
      await new Promise(() => undefined);
    });

    const events: BotEngineEvent[] = [];
    for await (const event of new OpenAiBotEngine().run(request({ signal: controller.signal }))) {
      events.push(event);
      if (event.type === 'text.delta') controller.abort();
    }

    expect(events).toEqual([
      { type: 'text.delta', text: 'Thinking' },
      { type: 'done', reason: 'cancelled' },
    ]);
    expect(run.seen?.options.signal.aborted).toBe(true);
  });
  it('sends an xAI turn to xAI’s API with its effort, unless the request names another endpoint', async () => {
    const run = scripted(async function* () {});

    await collect(new XaiBotEngine().run(request({ provider: 'xai', effort: 'high' })));
    expect(run.seen).toMatchObject({
      provider: { apiKey: KEY, baseURL: 'https://api.x.ai/v1' },
      agent: { modelSettings: { reasoning: { effort: 'high' } } },
    });

    await collect(
      new XaiBotEngine().run(request({ provider: 'xai', baseUrl: 'https://example.test/v1' })),
    );
    expect(run.seen?.provider.baseURL).toBe('https://example.test/v1');
  });
});
