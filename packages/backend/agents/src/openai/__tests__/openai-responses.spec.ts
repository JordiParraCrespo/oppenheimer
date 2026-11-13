/**
 * The OpenAI engine through the real Agents SDK, against a local server
 * that speaks the Responses API's stream: the key and base URL reach the
 * request, history goes in as input items, a tool call runs our tool and
 * its output goes back to the model, and the stream comes out as the
 * engine's events. What the scripted spec cannot see: that the SDK is
 * wired as the adapter assumes. The server answers as ChatGPT's backend
 * does, with the subscription's usage windows in its headers, which only a
 * ChatGPT turn reads.
 */
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { BotEngineEvent } from '../../bot-engine';
import { steerNote } from '../../turn';
import { ChatgptBotEngine } from '../chatgpt-bot-engine';
import { OpenAiBotEngine } from '../openai-bot-engine';

const KEY = 'sk-local-0123456789';

/**
 * The engine imports the Agents SDK on its first turn. Cold, under a parallel
 * `turbo test`, that import alone took 20-30s, which ran past each turn's
 * 20s abort signal and the test's own timeout: the turn came back as a bare
 * `done`. `beforeAll` pays for the import once, with its own budget, so a
 * turn's time is only the turn's.
 */
const SDK_IMPORT_MS = 120_000;
const TURN_MS = 30_000;

beforeAll(async () => {
  await Promise.all([import('@openai/agents'), import('openai')]);
}, SDK_IMPORT_MS);

type ResponsesRequest = {
  url?: string;
  authorization?: string;
  headers: Record<string, string | string[] | undefined>;
  body: Record<string, unknown>;
};

const usage = {
  input_tokens: 11,
  output_tokens: 3,
  total_tokens: 14,
  input_tokens_details: { cached_tokens: 0 },
  output_tokens_details: { reasoning_tokens: 0 },
};

/** The SSE body of one streamed response whose output is `item`. */
function streamOf(id: string, item: Record<string, unknown>, deltas: string[] = []): string {
  const response = {
    id,
    object: 'response',
    status: 'completed',
    model: 'model-placeholder',
    output: [item],
    usage,
  };
  const events = [
    { type: 'response.created', response: { ...response, status: 'in_progress', output: [] } },
    {
      type: 'response.output_item.added',
      output_index: 0,
      item: { ...item, status: 'in_progress' },
    },
    ...deltas.map((delta) => ({
      type: 'response.output_text.delta',
      item_id: item.id,
      output_index: 0,
      content_index: 0,
      delta,
    })),
    { type: 'response.output_item.done', output_index: 0, item },
    { type: 'response.completed', response },
  ];
  return sse(events);
}

/** Events as the SSE body the Responses API streams them in. */
function sse(events: Array<{ type: string }>): string {
  return events
    .map(
      (event, sequence) =>
        `event: ${event.type}\ndata: ${JSON.stringify({ ...event, sequence_number: sequence })}\n\n`,
    )
    .join('');
}

/** OpenAI's words for a failure on its side, whatever the request was (a placeholder of their shape). */
const PROCESSING_ERROR =
  'An error occurred while processing your request. You can retry your request.';

const failedResponse = {
  id: 'resp_f',
  object: 'response',
  status: 'failed',
  model: 'model-placeholder',
  output: [],
};

const started = {
  type: 'response.created',
  response: { ...failedResponse, status: 'in_progress' },
};

const callTool = streamOf('resp_1', {
  type: 'function_call',
  id: 'fc_1',
  call_id: 'call_1',
  name: 'get_time',
  arguments: '{"zone":"UTC"}',
  status: 'completed',
});

const answer = streamOf(
  'resp_2',
  {
    type: 'message',
    id: 'msg_1',
    role: 'assistant',
    status: 'completed',
    content: [{ type: 'output_text', text: 'It is 13:37.', annotations: [] }],
  },
  ['It is ', '13:37.'],
);

let server: Server;
let baseUrl: string;
let requests: ResponsesRequest[];
let replies: string[];

beforeEach(async () => {
  requests = [];
  replies = [callTool, answer];
  server = createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      requests.push({
        url: req.url,
        authorization: req.headers.authorization,
        headers: req.headers,
        body: JSON.parse(body),
      });
      // The windows move with each answer: the turn reports the last one's.
      const used = 10 * requests.length;
      res.writeHead(200, {
        'content-type': 'text/event-stream',
        'x-codex-primary-used-percent': String(used + 0.5),
        'x-codex-primary-window-minutes': '300',
        'x-codex-primary-reset-at': '1793040000',
        'x-codex-secondary-used-percent': String(used),
        'x-codex-secondary-window-minutes': '10080',
      });
      res.end(replies.shift());
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
});

afterEach(async () => {
  await new Promise((resolve) => server.close(resolve));
});

describe('OpenAiBotEngine on the Agents SDK', () => {
  // What breaks this: the compactor not wired as the SDK's input filter, so
  // an OpenAI, ChatGPT or Grok turn past its threshold sends everything it
  // read on every call and runs out of window, now that a turn has no step limit.
  it(
    'folds what the turn read into a summary before a call that would pass its threshold',
    async () => {
      const summary = streamOf('resp_s', {
        type: 'message',
        id: 'msg_s',
        role: 'assistant',
        status: 'completed',
        content: [{ type: 'output_text', text: '## Goal\nTell the time.', annotations: [] }],
      });
      replies = [summary, callTool, answer];
      const earlier = 'An earlier answer about clocks. '.repeat(120);
      const events: BotEngineEvent[] = [];
      for await (const event of new OpenAiBotEngine().run({
        provider: 'openai',
        apiKey: KEY,
        baseUrl,
        model: 'model-placeholder',
        contextWindow: 1_000,
        systemPrompt: 'You are a bot.',
        history: [
          { role: 'user', text: 'Tell me about clocks.' },
          { role: 'assistant', text: earlier },
        ],
        message: 'What time is it?',
        tools: [
          {
            name: 'get_time',
            description: 'The time',
            inputSchema: { type: 'object', properties: { zone: { type: 'string' } } },
            run: async () => ({ content: '13:37 UTC' }),
          },
        ],
        signal: AbortSignal.timeout(20_000),
        scratchDir: '/unused',
      })) {
        events.push(event);
      }

      expect(requests).toHaveLength(3);
      const [summarize, firstCall, secondCall] = requests;
      expect(JSON.stringify(summarize.body.input)).toContain('An earlier answer about clocks.');
      expect(summarize.body.tools ?? []).toEqual([]);
      for (const call of [firstCall, secondCall]) {
        const sent = JSON.stringify(call.body.input);
        expect(sent).toContain('## Goal');
        expect(sent).toContain('What time is it?');
        expect(sent).not.toContain('An earlier answer about clocks.');
      }
      expect(events).toContainEqual(expect.objectContaining({ type: 'compacted' }));
      expect(events.at(-1)).toEqual({ type: 'done', reason: 'completed' });
    },
    TURN_MS,
  );

  it(
    'runs a turn with a tool call over the Responses API',
    async () => {
      const events: BotEngineEvent[] = [];
      for await (const event of new OpenAiBotEngine().run({
        provider: 'openai',
        apiKey: KEY,
        baseUrl,
        model: 'model-placeholder',
        effort: 'low',
        cacheKey: 'conversation-placeholder',
        systemPrompt: 'You are a bot.',
        history: [
          { role: 'user', text: 'Hi' },
          { role: 'assistant', text: 'Hello.' },
        ],
        message: 'What time is it?',
        tools: [
          {
            name: 'get_time',
            description: 'The time',
            inputSchema: { type: 'object', properties: { zone: { type: 'string' } } },
            run: async () => {
              throw new Error('clock broken');
            },
          },
        ],
        signal: AbortSignal.timeout(20_000),
        scratchDir: '/unused',
      })) {
        events.push(event);
      }

      expect(events).toEqual([
        { type: 'tool.started', callId: 'call_1', name: 'get_time', input: { zone: 'UTC' } },
        {
          type: 'tool.finished',
          callId: 'call_1',
          name: 'get_time',
          output: 'clock broken',
          isError: true,
        },
        { type: 'text.delta', text: 'It is ' },
        { type: 'text.delta', text: '13:37.' },
        { type: 'text.done', text: 'It is 13:37.' },
        // What the last call was sent; a key's turn reads no plan windows.
        {
          type: 'usage',
          inputTokens: 22,
          outputTokens: 6,
          cacheReadTokens: 0,
          context: { tokens: 11, window: null },
        },
        { type: 'done', reason: 'completed' },
      ]);

      expect(requests).toHaveLength(2);
      const [first, second] = requests;
      expect(first.authorization).toBe(`Bearer ${KEY}`);
      // OpenAI's API on a key carries none of what ChatGPT's backend requires.
      expect(first.headers['chatgpt-account-id']).toBeUndefined();
      expect(first.body).not.toHaveProperty('store');
      // Both steps of the turn name the conversation, so they reach the server that cached its prefix.
      for (const sent of requests) {
        expect(sent.body.prompt_cache_key).toBe('conversation-placeholder');
      }
      expect(first.body).toMatchObject({
        model: 'model-placeholder',
        instructions: 'You are a bot.',
        reasoning: { effort: 'low' },
        tools: [
          { type: 'function', name: 'get_time', strict: false, parameters: { type: 'object' } },
        ],
        input: [
          { role: 'user', content: 'Hi' },
          { role: 'assistant', content: [{ type: 'output_text', text: 'Hello.' }] },
          { role: 'user', content: 'What time is it?' },
        ],
      });
      expect(second.body.input).toContainEqual(
        expect.objectContaining({
          type: 'function_call_output',
          call_id: 'call_1',
          output: 'clock broken',
        }),
      );
    },
    TURN_MS,
  );

  it(
    'hands the model what the person sent meanwhile with the next tool result, once',
    async () => {
      const sent = [[{ id: 'message-1', text: 'Use Tokyo time instead.' }], []];
      let asks = 0;
      const events: BotEngineEvent[] = [];
      for await (const event of new OpenAiBotEngine().run({
        provider: 'openai',
        apiKey: KEY,
        baseUrl,
        model: 'model-placeholder',
        systemPrompt: 'You are a bot.',
        history: [],
        message: 'What time is it?',
        tools: [
          {
            name: 'get_time',
            description: 'The time',
            inputSchema: { type: 'object', properties: { zone: { type: 'string' } } },
            run: async () => ({ content: '13:37 UTC' }),
          },
        ],
        steering: {
          take: async () => {
            asks += 1;
            return sent.shift() ?? [];
          },
        },
        signal: AbortSignal.timeout(20_000),
        scratchDir: '/unused',
      })) {
        events.push(event);
      }

      const steers = [{ id: 'message-1', text: 'Use Tokyo time instead.' }];
      // The tool's own output on its line, the delivery right after it.
      expect(events.slice(0, 3)).toEqual([
        { type: 'tool.started', callId: 'call_1', name: 'get_time', input: { zone: 'UTC' } },
        {
          type: 'tool.finished',
          callId: 'call_1',
          name: 'get_time',
          output: '13:37 UTC',
          isError: false,
        },
        { type: 'steered', callId: 'call_1', steers },
      ]);
      expect(asks).toBe(1);
      // What the model read: the result, then the message, marked as the person's.
      expect(requests[1]?.body.input).toContainEqual(
        expect.objectContaining({
          type: 'function_call_output',
          call_id: 'call_1',
          output: `13:37 UTC${steerNote(steers)}`,
        }),
      );
      expect(steerNote(steers)).toContain('Use Tokyo time instead.');
    },
    TURN_MS,
  );

  it(
    "runs a chatgpt turn on the sign-in's token, with what ChatGPT's backend requires",
    async () => {
      const events: BotEngineEvent[] = [];
      for await (const event of new ChatgptBotEngine().run({
        provider: 'chatgpt',
        apiKey: KEY,
        accountId: 'account-placeholder',
        baseUrl,
        model: 'model-placeholder',
        cacheKey: 'conversation-placeholder',
        systemPrompt: 'You are a bot.',
        history: [],
        message: 'What time is it?',
        tools: [
          {
            name: 'get_time',
            description: 'The time',
            inputSchema: { type: 'object', properties: { zone: { type: 'string' } } },
            run: async () => ({ content: '13:37' }),
          },
        ],
        signal: AbortSignal.timeout(20_000),
        scratchDir: '/unused',
      })) {
        events.push(event);
      }

      expect(events.at(-1)).toEqual({ type: 'done', reason: 'completed' });
      // The subscription's windows as the last answer said them.
      expect(events.find((event) => event.type === 'usage')).toMatchObject({
        limits: {
          fiveHour: { usedPercent: 20.5, resetsAt: new Date(1_793_040_000_000) },
          sevenDay: { usedPercent: 20, resetsAt: null },
        },
      });
      expect(requests).toHaveLength(2);
      for (const sent of requests) {
        expect(sent.url).toBe('/v1/responses');
        expect(sent.authorization).toBe(`Bearer ${KEY}`);
        expect(sent.headers['chatgpt-account-id']).toBe('account-placeholder');
        expect(sent.headers['openai-beta']).toBe('responses=experimental');
        expect(sent.headers.originator).toBe('oppenheimer');
        expect(sent.body).toMatchObject({
          instructions: 'You are a bot.',
          stream: true,
          store: false,
          include: ['reasoning.encrypted_content'],
          // Beside what the backend requires, not in place of it.
          prompt_cache_key: 'conversation-placeholder',
        });
        expect(sent.body).not.toHaveProperty('extraHeaders');
        expect(sent.body).not.toHaveProperty('extra_headers');
      }
    },
    TURN_MS,
  );

  // What breaks this: reading a failure's kind only from the HTTP status.
  // A stream the provider opened with a 200 and then failed carries none, so
  // OpenAI's own outage ("An error occurred while processing your request")
  // read as `other`: the chat could not say a retry may help, and every one
  // was reported as ours to fix (OPPENHEIMER-API-4).
  it.each([
    [
      'an error event',
      { type: 'error', code: 'server_error', message: PROCESSING_ERROR, param: null },
    ],
    [
      'a failed response',
      {
        type: 'response.failed',
        response: {
          ...failedResponse,
          error: { code: 'server_error', message: PROCESSING_ERROR },
        },
      },
    ],
  ])(
    'reads a stream the provider failed with %s as the provider unavailable',
    async (_, end) => {
      replies = [sse([started, end])];
      const events: BotEngineEvent[] = [];
      for await (const event of new OpenAiBotEngine().run({
        provider: 'openai',
        apiKey: KEY,
        baseUrl,
        model: 'model-placeholder',
        systemPrompt: 'You are a bot.',
        history: [],
        message: 'Hi',
        tools: [],
        signal: AbortSignal.timeout(20_000),
        scratchDir: '/unused',
      })) {
        events.push(event);
      }

      expect(events.at(-1)).toEqual({
        type: 'done',
        reason: 'failed',
        error: PROCESSING_ERROR,
        failure: 'unavailable',
      });
    },
    TURN_MS,
  );

  // What breaks this: knowing only the public API's `server_error`. ChatGPT's
  // Codex backend says it is overloaded with a `response.failed` whose code is
  // `server_is_overloaded` (the Codex CLI reads it the same way), so a
  // subscription turn that met it read as `other` and was reported as ours to
  // fix (OPPENHEIMER-API-4, after #818).
  it(
    'reads a chatgpt stream the backend failed as overloaded as the provider unavailable',
    async () => {
      const overloaded = 'The servers are overloaded right now (a placeholder of their words).';
      replies = [
        sse([
          started,
          {
            type: 'response.failed',
            response: {
              ...failedResponse,
              error: { code: 'server_is_overloaded', message: overloaded },
            },
          },
        ]),
      ];
      const events: BotEngineEvent[] = [];
      for await (const event of new ChatgptBotEngine().run({
        provider: 'chatgpt',
        apiKey: KEY,
        accountId: 'account-placeholder',
        baseUrl,
        model: 'model-placeholder',
        systemPrompt: 'You are a bot.',
        history: [],
        message: 'Hi',
        tools: [],
        signal: AbortSignal.timeout(20_000),
        scratchDir: '/unused',
      })) {
        events.push(event);
      }

      expect(events.at(-1)).toEqual({
        type: 'done',
        reason: 'failed',
        error: overloaded,
        failure: 'unavailable',
      });
    },
    TURN_MS,
  );

  it('fails a chatgpt turn that names no account, without calling the backend', async () => {
    const events: BotEngineEvent[] = [];
    for await (const event of new ChatgptBotEngine().run({
      provider: 'chatgpt',
      apiKey: KEY,
      baseUrl,
      model: 'model-placeholder',
      systemPrompt: 'You are a bot.',
      history: [],
      message: 'Hi',
      tools: [],
      signal: AbortSignal.timeout(20_000),
      scratchDir: '/unused',
    })) {
      events.push(event);
    }

    expect(events).toEqual([
      {
        type: 'done',
        reason: 'failed',
        error: 'A ChatGPT turn needs the account it acts for',
        failure: 'credential',
      },
    ]);
    expect(requests).toHaveLength(0);
  });
});
