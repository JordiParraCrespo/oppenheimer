/**
 * The OpenAI engine's translation of the Agents SDK's stream events into
 * the engine's events, and what it hands the SDK: instructions, history as
 * input items, tools, effort and the step limit. The SDK's run is replaced
 * by a scripted stream that calls our tools the way the SDK would.
 */
import { describe, expect, it } from 'vitest';
import type { BotEngineEvent, BotEngineTool, BotTurnRequest } from '../../bot-engine';
import {
  OpenAiBotEngine,
  type OpenAiRun,
  type OpenAiRunSpec,
  type OpenAiStart,
} from '../openai-bot-engine';
import type { OpenAiStreamEvent } from '../openai-events';

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

/** A run that records its spec and streams what `script` yields; `error` is how it ended. */
function scripted(
  script: (spec: OpenAiRunSpec) => AsyncGenerator<OpenAiStreamEvent>,
  error: unknown = null,
) {
  const seen: { spec?: OpenAiRunSpec } = {};
  const start: OpenAiStart = async (spec) => {
    seen.spec = spec;
    const run: OpenAiRun = {
      [Symbol.asyncIterator]: () => script(spec),
      completed: Promise.resolve(),
      error,
    };
    return run;
  };
  return { start, seen };
}

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
    const { start } = scripted(async function* () {
      yield textDelta('Hel');
      yield textDelta('lo');
      yield responseDone(10, 2);
      yield message('Hello');
      yield responseDone(4, 1);
    });

    const events = await collect(new OpenAiBotEngine(start).run(request()));

    expect(events).toEqual([
      { type: 'text.delta', text: 'Hel' },
      { type: 'text.delta', text: 'lo' },
      { type: 'text.done', text: 'Hello' },
      { type: 'usage', inputTokens: 14, outputTokens: 3 },
      { type: 'done', reason: 'completed' },
    ]);
  });

  it('runs our tools, and reports a thrown error as a failed call the model reads', async () => {
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
        throw new Error('boom');
      },
    };
    const { start, seen } = scripted(async function* (spec) {
      // What the SDK does with a function call: parse, execute, report.
      const [time, fail] = spec.tools;
      yield toolCalled('call_1', 'get_time', '{"zone":"UTC"}');
      yield toolOutput('call_1', 'get_time', await time.execute({ zone: 'UTC' }, 'call_1'));
      yield toolCalled('call_2', 'broken', '{}');
      yield toolOutput('call_2', 'broken', await fail.execute({}, 'call_2'));
      yield message('Done');
    });

    const events = await collect(
      new OpenAiBotEngine(start).run(request({ tools: [getTime, broken] })),
    );

    expect(
      seen.spec?.tools.map(({ name, description, parameters }) => ({
        name,
        description,
        parameters,
      })),
    ).toEqual([
      { name: 'get_time', description: 'The time', parameters: getTime.inputSchema },
      { name: 'broken', description: 'Always throws', parameters: broken.inputSchema },
    ]);
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
      { type: 'tool.finished', callId: 'call_2', name: 'broken', output: 'boom', isError: true },
    ]);
    expect(events.at(-1)).toEqual({ type: 'done', reason: 'completed' });
  });

  it('sends the history as native input items, then this message', async () => {
    const { start, seen } = scripted(async function* () {});

    await collect(
      new OpenAiBotEngine(start).run(
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

    expect(seen.spec).toMatchObject({
      apiKey: KEY,
      baseUrl: 'https://example.test/v1',
      model: 'model-placeholder',
      instructions: 'You are a bot.',
      effort: 'xhigh',
      maxTurns: 4,
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

  it('ends with max_steps when the SDK stops at the turn limit', async () => {
    const maxTurns = Object.assign(new Error('Max turns (4) exceeded'), {
      name: 'MaxTurnsExceededError',
    });
    const { start } = scripted(async function* () {}, maxTurns);

    const events = await collect(new OpenAiBotEngine(start).run(request()));

    expect(events).toEqual([{ type: 'done', reason: 'max_steps' }]);
  });

  it('fails without the key in the error when the run errors', async () => {
    const { start } = scripted(async function* () {
      yield textDelta('Hi');
      throw new Error(`401 Incorrect API key provided: ${KEY}`);
    });

    const events = await collect(new OpenAiBotEngine(start).run(request()));

    const done = events.at(-1) as { type: string; reason: string; error: string };
    expect(done.reason).toBe('failed');
    expect(done.error).toContain('Incorrect API key provided');
    expect(done.error).not.toContain(KEY);
  });

  it('fails when the run cannot start', async () => {
    const start: OpenAiStart = async () => {
      throw new Error('connect ECONNREFUSED');
    };

    const events = await collect(new OpenAiBotEngine(start).run(request()));

    expect(events).toEqual([{ type: 'done', reason: 'failed', error: 'connect ECONNREFUSED' }]);
  });

  it('cancels promptly on abort and passes the signal to the SDK', async () => {
    const controller = new AbortController();
    const { start, seen } = scripted(async function* () {
      yield textDelta('Thinking');
      await new Promise(() => undefined);
    });

    const events: BotEngineEvent[] = [];
    for await (const event of new OpenAiBotEngine(start).run(
      request({ signal: controller.signal }),
    )) {
      events.push(event);
      if (event.type === 'text.delta') controller.abort();
    }

    expect(events).toEqual([
      { type: 'text.delta', text: 'Thinking' },
      { type: 'done', reason: 'cancelled' },
    ]);
    expect(seen.spec?.signal.aborted).toBe(true);
  });
});
