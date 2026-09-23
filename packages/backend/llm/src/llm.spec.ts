import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { LlmError } from './llm.errors';
import { createLlmService, llmIsConfigured } from './llm.factory';
import { AnthropicLlmService } from './providers/anthropic.llm-service';
import { NoopLlmService } from './providers/noop.llm-service';
import { OpenAiCompatibleLlmService } from './providers/openai-compatible.llm-service';
import { OpenRouterLlmService } from './providers/openrouter.llm-service';
import { TogetherLlmService } from './providers/together.llm-service';

/**
 * A real server rather than a mocked `fetch`: the timeout is the behaviour that
 * matters most here, and it only means something against a socket that is
 * genuinely slow to answer.
 */
interface Seen {
  url: string;
  headers: IncomingHttpHeaders;
  body: Record<string, unknown>;
}

let server: Server;
let baseUrl: string;
let seen: Seen[];
let reply: { status: number; body: unknown; delayMs?: number };

beforeAll(async () => {
  server = createServer((request, response) => {
    let raw = '';
    request.on('data', (chunk) => {
      raw += chunk;
    });
    request.on('end', () => {
      seen.push({
        url: request.url ?? '',
        headers: request.headers,
        body: JSON.parse(raw || '{}'),
      });
      const send = () => {
        const payload = typeof reply.body === 'string' ? reply.body : JSON.stringify(reply.body);
        response.writeHead(reply.status, { 'content-type': 'application/json' });
        response.end(payload);
      };
      if (reply.delayMs) setTimeout(send, reply.delayMs);
      else send();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  seen = [];
  reply = {
    status: 200,
    body: {
      model: 'served-model',
      choices: [{ message: { role: 'assistant', content: 'Hello there' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 12, completion_tokens: 3 },
    },
  };
});

async function failure(promise: Promise<unknown>): Promise<LlmError> {
  const error = await promise.then(
    () => {
      throw new Error('expected the call to fail');
    },
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(LlmError);
  return error as LlmError;
}

describe('createLlmService', () => {
  it('builds the client each provider setting names', () => {
    expect(createLlmService({ provider: 'openrouter' })).toBeInstanceOf(OpenRouterLlmService);
    expect(createLlmService({ provider: 'together' })).toBeInstanceOf(TogetherLlmService);
    expect(createLlmService({ provider: 'anthropic' })).toBeInstanceOf(AnthropicLlmService);
    expect(createLlmService({ provider: 'openai-compatible' })).toBeInstanceOf(
      OpenAiCompatibleLlmService,
    );
    expect(createLlmService({ provider: 'none' })).toBeInstanceOf(NoopLlmService);
  });

  it('is configured only once a provider has what it needs to make a call', () => {
    expect(llmIsConfigured({ provider: 'none' })).toBe(false);
    // The hosted presets need a key; their base URL is built in.
    expect(llmIsConfigured({ provider: 'openrouter' })).toBe(false);
    expect(llmIsConfigured({ provider: 'openrouter', apiKey: 'k' })).toBe(true);
    expect(llmIsConfigured({ provider: 'together', apiKey: 'k' })).toBe(true);
    expect(llmIsConfigured({ provider: 'anthropic', apiKey: 'k' })).toBe(true);
    // A self-hosted server needs a URL and no key.
    expect(llmIsConfigured({ provider: 'openai-compatible' })).toBe(false);
    expect(llmIsConfigured({ provider: 'openai-compatible', baseUrl })).toBe(true);
  });
});

describe('OpenAiCompatibleLlmService', () => {
  it('sends the system prompt as the first message and reads the first choice', async () => {
    const llm = createLlmService({ provider: 'openai-compatible', baseUrl, model: 'a-model' });

    const completion = await llm.complete({
      system: 'Be brief.',
      messages: [{ role: 'user', content: 'Hi' }],
      maxTokens: 16,
      temperature: 0,
    });

    expect(seen[0].url).toBe('/v1/chat/completions');
    expect(seen[0].body).toEqual({
      model: 'a-model',
      messages: [
        { role: 'system', content: 'Be brief.' },
        { role: 'user', content: 'Hi' },
      ],
      max_tokens: 16,
      temperature: 0,
    });
    // No key configured means no header at all, not an empty bearer.
    expect(seen[0].headers.authorization).toBeUndefined();
    expect(completion).toEqual({
      text: 'Hello there',
      model: 'served-model',
      provider: 'openai-compatible',
      finishReason: 'stop',
      usage: { inputTokens: 12, outputTokens: 3 },
    });
  });

  it('lets a request name its own model over the default', async () => {
    const llm = createLlmService({ provider: 'openai-compatible', baseUrl, model: 'default' });
    await llm.complete({ model: 'override', messages: [{ role: 'user', content: 'Hi' }] });
    expect(seen[0].body.model).toBe('override');
  });

  it('refuses a call that names no model and has no default', async () => {
    const llm = createLlmService({ provider: 'openai-compatible', baseUrl });
    const error = await failure(llm.complete({ messages: [{ role: 'user', content: 'Hi' }] }));
    expect(error.code).toBe('not_configured');
    expect(seen).toHaveLength(0);
  });

  it('abandons a call that runs past its timeout', async () => {
    reply.delayMs = 500;
    const llm = createLlmService({ provider: 'openai-compatible', baseUrl, model: 'm' });

    const started = Date.now();
    const error = await failure(
      llm.complete({ messages: [{ role: 'user', content: 'Hi' }], timeoutMs: 50 }),
    );

    expect(error.code).toBe('timeout');
    expect(Date.now() - started).toBeLessThan(400);
  });

  it('falls back to the configured timeout when a request sets none', async () => {
    reply.delayMs = 500;
    const llm = createLlmService({
      provider: 'openai-compatible',
      baseUrl,
      model: 'm',
      timeoutMs: 50,
    });
    const error = await failure(llm.complete({ messages: [{ role: 'user', content: 'Hi' }] }));
    expect(error.code).toBe('timeout');
  });

  it('reports the caller’s own cancellation as aborted', async () => {
    reply.delayMs = 500;
    const llm = createLlmService({ provider: 'openai-compatible', baseUrl, model: 'm' });
    const controller = new AbortController();

    const call = llm.complete({
      messages: [{ role: 'user', content: 'Hi' }],
      signal: controller.signal,
    });
    controller.abort();

    expect((await failure(call)).code).toBe('aborted');
  });

  it('carries a non-2xx status on the error', async () => {
    reply = { status: 429, body: { error: { message: 'slow down' } } };
    const llm = createLlmService({ provider: 'openai-compatible', baseUrl, model: 'm' });

    const error = await failure(llm.complete({ messages: [{ role: 'user', content: 'Hi' }] }));

    expect(error.code).toBe('http');
    expect(error.status).toBe(429);
    expect(error.message).toContain('slow down');
  });

  it('treats a body of the wrong shape as an invalid response', async () => {
    reply = { status: 200, body: { choices: [] } };
    const llm = createLlmService({ provider: 'openai-compatible', baseUrl, model: 'm' });
    const error = await failure(llm.complete({ messages: [{ role: 'user', content: 'Hi' }] }));
    expect(error.code).toBe('invalid_response');
  });

  it('reports an unreachable server as a network failure', async () => {
    const llm = createLlmService({
      provider: 'openai-compatible',
      baseUrl: 'http://127.0.0.1:1/v1',
      model: 'm',
    });
    const error = await failure(llm.complete({ messages: [{ role: 'user', content: 'Hi' }] }));
    expect(error.code).toBe('network');
  });
});

describe('OpenRouterLlmService', () => {
  it('authenticates with its key and introduces the app', async () => {
    const llm = createLlmService({
      provider: 'openrouter',
      apiKey: 'or-key',
      baseUrl,
      model: 'meta-llama/llama-3.1-8b-instruct',
      appName: 'Oppenheimer',
      appUrl: 'https://example.test',
    });

    const completion = await llm.complete({ messages: [{ role: 'user', content: 'Hi' }] });

    expect(seen[0].headers.authorization).toBe('Bearer or-key');
    expect(seen[0].headers['x-title']).toBe('Oppenheimer');
    expect(seen[0].headers['http-referer']).toBe('https://example.test');
    expect(completion.provider).toBe('openrouter');
  });
});

describe('AnthropicLlmService', () => {
  it('speaks the Messages shape and joins the text blocks', async () => {
    reply.body = {
      model: 'served-model',
      content: [
        { type: 'thinking', thinking: 'hmm' },
        { type: 'text', text: 'Hello ' },
        { type: 'text', text: 'there' },
      ],
      stop_reason: 'end_turn',
      usage: { input_tokens: 9, output_tokens: 2 },
    };
    const llm = createLlmService({ provider: 'anthropic', apiKey: 'sk', baseUrl, model: 'm' });

    const completion = await llm.complete({
      system: 'Be brief.',
      messages: [{ role: 'user', content: 'Hi' }],
      maxTokens: 16,
    });

    expect(seen[0].url).toBe('/v1/messages');
    expect(seen[0].headers['x-api-key']).toBe('sk');
    expect(seen[0].headers['anthropic-version']).toBe('2023-06-01');
    expect(seen[0].body).toEqual({
      model: 'm',
      max_tokens: 16,
      system: 'Be brief.',
      messages: [{ role: 'user', content: 'Hi' }],
    });
    expect(completion).toEqual({
      text: 'Hello there',
      model: 'served-model',
      provider: 'anthropic',
      finishReason: 'end_turn',
      usage: { inputTokens: 9, outputTokens: 2 },
    });
  });
});

describe('NoopLlmService', () => {
  it('refuses every call without touching the network', async () => {
    const error = await failure(new NoopLlmService().complete());
    expect(error.code).toBe('not_configured');
  });
});
