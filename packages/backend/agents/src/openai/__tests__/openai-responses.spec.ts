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
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { BotEngineEvent } from '../../bot-engine';
import { ChatgptBotEngine } from '../chatgpt-bot-engine';
import { OpenAiBotEngine } from '../openai-bot-engine';

const KEY = 'sk-local-0123456789';

/**
 * The engine imports the Agents SDK on its first turn, and this spec is that
 * first turn: a cold import under a parallel `turbo test` took longer than
 * Vitest's 5s default on its own.
 */
const SDK_LOAD_MS = 30_000;

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
  return events
    .map(
      (event, sequence) =>
        `event: ${event.type}\ndata: ${JSON.stringify({ ...event, sequence_number: sequence })}\n\n`,
    )
    .join('');
}

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

beforeEach(async () => {
  requests = [];
  const replies = [callTool, answer];
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
    SDK_LOAD_MS,
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
        });
        expect(sent.body).not.toHaveProperty('extraHeaders');
        expect(sent.body).not.toHaveProperty('extra_headers');
      }
    },
    SDK_LOAD_MS,
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
      { type: 'done', reason: 'failed', error: 'A ChatGPT turn needs the account it acts for' },
    ]);
    expect(requests).toHaveLength(0);
  });
});
