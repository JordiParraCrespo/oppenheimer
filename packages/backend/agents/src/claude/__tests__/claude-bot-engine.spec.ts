/**
 * The Claude engine's translation of the Agent SDK's messages into the
 * engine's events, and what it hands the SDK: options, environment, tools
 * and history. The SDK module is mocked so its `query` replays a scripted
 * stream; our tools are called through the real in-process MCP server. The
 * live spec runs the real subprocess.
 */
import { getEventListeners } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Options, Query, SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BotEngineEvent, BotEngineTool, BotTurnRequest } from '../../bot-engine';
import { ClaudeBotEngine } from '../claude-bot-engine';
import { BUILT_IN_TOOLS, DISALLOWED_TOOLS, GLM_BASE_URL } from '../claude-options';

const sdk = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('@anthropic-ai/claude-agent-sdk', () => sdk);

const KEY = 'sk-test-secret-key-0123456789';

let scratchDir: string;
beforeEach(async () => {
  scratchDir = await mkdtemp(join(tmpdir(), 'bot-engine-'));
});
afterEach(async () => {
  await rm(scratchDir, { recursive: true, force: true });
});

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
    scratchDir,
    ...overrides,
  };
}

async function collect(events: AsyncIterable<BotEngineEvent>): Promise<BotEngineEvent[]> {
  const out: BotEngineEvent[] = [];
  for await (const event of events) out.push(event);
  return out;
}

/**
 * Makes the SDK's `query` record its options and replay `messages`, which
 * may depend on them and on `closed`, which settles when the query is closed.
 */
function scripted(
  messages: (options: Options, closed: Promise<void>) => AsyncIterable<SDKMessage> | SDKMessage[],
) {
  const seen: { prompt?: string; options?: Options; closed: boolean } = { closed: false };
  sdk.query.mockImplementation(({ prompt, options }: { prompt: string; options: Options }) => {
    seen.prompt = prompt;
    seen.options = options;
    let onClose = () => {};
    const closed = new Promise<void>((resolve) => {
      onClose = resolve;
    });
    const source = messages(options, closed);
    return {
      async *[Symbol.asyncIterator]() {
        yield* source;
      },
      close() {
        seen.closed = true;
        onClose();
      },
    } as unknown as Query;
  });
  return { seen };
}

const delta = (text: string, parent: string | null = null) =>
  ({
    type: 'stream_event',
    parent_tool_use_id: parent,
    event: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } },
  }) as unknown as SDKMessage;

const assistant = (content: unknown[], extra: Record<string, unknown> = {}) =>
  ({
    type: 'assistant',
    parent_tool_use_id: null,
    message: { content },
    ...extra,
  }) as unknown as SDKMessage;

const toolResults = (content: unknown[]) =>
  ({
    type: 'user',
    parent_tool_use_id: null,
    message: { role: 'user', content },
  }) as unknown as SDKMessage;

const usage = {
  input_tokens: 10,
  output_tokens: 5,
  cache_read_input_tokens: 3,
  cache_creation_input_tokens: 2,
};

const success = (overrides: Record<string, unknown> = {}) =>
  ({
    type: 'result',
    subtype: 'success',
    is_error: false,
    result: 'ok',
    usage,
    ...overrides,
  }) as unknown as SDKMessage;

describe('ClaudeBotEngine', () => {
  it('streams text, reports each text block, usage and a completed end', async () => {
    scripted(() => [
      delta('Hel'),
      delta('lo'),
      delta('subagent text', 'toolu_parent'),
      assistant([{ type: 'text', text: 'Hello' }]),
      success(),
    ]);

    const events = await collect(new ClaudeBotEngine().run(request()));

    expect(events).toEqual([
      { type: 'text.delta', text: 'Hel' },
      { type: 'text.delta', text: 'lo' },
      { type: 'text.done', text: 'Hello' },
      { type: 'usage', inputTokens: 15, outputTokens: 5 },
      { type: 'done', reason: 'completed' },
    ]);
  });

  it('runs our tools through the in-process MCP server, under our names, with the key redacted', async () => {
    const getTime: BotEngineTool = {
      name: 'get_time',
      description: 'The time',
      inputSchema: { type: 'object', properties: { zone: { type: 'string' } } },
      run: async (input) => ({ content: `12:00 in ${(input as { zone: string }).zone}` }),
    };
    const broken: BotEngineTool = {
      name: 'broken',
      description: 'Always throws, echoing the key',
      inputSchema: { type: 'object', properties: {} },
      run: async () => {
        throw new Error(`upstream refused ${KEY}`);
      },
    };
    let listed: unknown;
    let modelRead: unknown;
    scripted(async function* (options) {
      // What Claude Code does with an sdk server: connect, list, call.
      const server = (options.mcpServers as Record<string, { instance: McpServer }>).oppenheimer
        .instance;
      const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
      await server.connect(serverSide);
      const client = new Client({ name: 'test', version: '1.0.0' });
      await client.connect(clientSide);
      listed = (await client.listTools()).tools;
      const ok = await client.callTool({ name: 'get_time', arguments: { zone: 'UTC' } });
      const bad = await client.callTool({ name: 'broken', arguments: {} });
      modelRead = bad.content;
      await client.close();

      yield assistant([
        {
          type: 'tool_use',
          id: 'toolu_1',
          name: 'mcp__oppenheimer__get_time',
          input: { zone: 'UTC' },
        },
        { type: 'tool_use', id: 'toolu_2', name: 'mcp__oppenheimer__broken', input: {} },
      ]);
      yield toolResults([
        { type: 'tool_result', tool_use_id: 'toolu_1', content: ok.content, is_error: ok.isError },
        {
          type: 'tool_result',
          tool_use_id: 'toolu_2',
          content: bad.content,
          is_error: bad.isError,
        },
      ]);
      yield success();
    });

    const events = await collect(new ClaudeBotEngine().run(request({ tools: [getTime, broken] })));

    expect(listed).toEqual([
      expect.objectContaining({ name: 'get_time', inputSchema: getTime.inputSchema }),
      expect.objectContaining({ name: 'broken' }),
    ]);
    expect(events.filter((event) => event.type.startsWith('tool.'))).toEqual([
      { type: 'tool.started', callId: 'toolu_1', name: 'get_time', input: { zone: 'UTC' } },
      { type: 'tool.started', callId: 'toolu_2', name: 'broken', input: {} },
      {
        type: 'tool.finished',
        callId: 'toolu_1',
        name: 'get_time',
        output: '12:00 in UTC',
        isError: false,
      },
      {
        type: 'tool.finished',
        callId: 'toolu_2',
        name: 'broken',
        output: 'upstream refused [redacted]',
        isError: true,
      },
    ]);
    // What the model read is the same redacted text.
    expect(modelRead).toEqual([{ type: 'text', text: 'upstream refused [redacted]' }]);
    expect(events.at(-1)).toEqual({ type: 'done', reason: 'completed' });
  });

  it('keeps built-in tool names and reports their results', async () => {
    scripted(() => [
      assistant([{ type: 'tool_use', id: 'toolu_w', name: 'WebSearch', input: { query: 'x' } }]),
      toolResults([
        {
          type: 'tool_result',
          tool_use_id: 'toolu_w',
          content: [{ type: 'text', text: 'results' }],
        },
      ]),
      success(),
    ]);

    const events = await collect(new ClaudeBotEngine().run(request()));

    expect(events.slice(0, 2)).toEqual([
      { type: 'tool.started', callId: 'toolu_w', name: 'WebSearch', input: { query: 'x' } },
      {
        type: 'tool.finished',
        callId: 'toolu_w',
        name: 'WebSearch',
        output: 'results',
        isError: false,
      },
    ]);
  });

  it('runs without a shell, prompts or inherited secrets', async () => {
    process.env.DATABASE_URL = 'postgres://secret';
    process.env.ANTHROPIC_API_KEY = 'the-apis-own-key';
    try {
      const { seen } = scripted(() => [success()]);
      const tool: BotEngineTool = {
        name: 'remember',
        description: '',
        inputSchema: {},
        run: async () => ({ content: '' }),
      };

      await collect(
        new ClaudeBotEngine().run(request({ tools: [tool], effort: 'high', maxSteps: 7 })),
      );

      const options = seen.options as Options;
      expect(options.tools).toEqual(BUILT_IN_TOOLS);
      expect(options.tools).not.toContain('Bash');
      // WebFetch reached the server's own loopback and private network, and
      // subagents were how a bot searched the server's disk.
      expect(options.tools).not.toEqual(expect.arrayContaining(['WebFetch']));
      expect(options.tools).not.toEqual(expect.arrayContaining(['Agent']));
      expect(options.disallowedTools).toEqual(
        expect.arrayContaining([
          'Bash',
          'Read',
          'Write',
          'Edit',
          'Glob',
          'Grep',
          'WebFetch',
          'Agent',
        ]),
      );
      for (const kept of BUILT_IN_TOOLS) expect(DISALLOWED_TOOLS).not.toContain(kept);
      expect(options.allowedTools).toEqual([...BUILT_IN_TOOLS, 'mcp__oppenheimer__remember']);
      expect(options.permissionMode).toBe('dontAsk');
      expect(options.settingSources).toEqual([]);
      expect(options.strictMcpConfig).toBe(true);
      expect(options.persistSession).toBe(false);
      expect(options.includePartialMessages).toBe(true);
      expect(options.maxTurns).toBe(7);
      expect(options.effort).toBe('high');
      expect(options.cwd).toBe(join(scratchDir, 'work'));

      const env = options.env as Record<string, string>;
      expect(env.ANTHROPIC_API_KEY).toBe(KEY);
      expect(env.ANTHROPIC_BASE_URL).toBeUndefined();
      expect(env.ANTHROPIC_AUTH_TOKEN).toBeUndefined();
      expect(env.DATABASE_URL).toBeUndefined();
      expect(env.HOME).toBe(join(scratchDir, 'home'));
      expect(env.CLAUDE_CONFIG_DIR).toBe(join(scratchDir, 'home', '.claude'));
      expect(env.PATH).toBeTruthy();
    } finally {
      delete process.env.DATABASE_URL;
      delete process.env.ANTHROPIC_API_KEY;
    }
  });

  it('sends glm to z.ai with the key as a bearer token, unless a base URL is given', async () => {
    const glm = scripted(() => [success()]);
    await collect(new ClaudeBotEngine().run(request({ provider: 'glm' })));
    const env = glm.seen.options?.env as Record<string, string>;
    expect(env.ANTHROPIC_BASE_URL).toBe(GLM_BASE_URL);
    expect(env.ANTHROPIC_AUTH_TOKEN).toBe(KEY);
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();

    const custom = scripted(() => [success()]);
    await collect(
      new ClaudeBotEngine().run(
        request({ provider: 'glm', baseUrl: 'https://example.test/anthropic' }),
      ),
    );
    expect((custom.seen.options as Options).env?.ANTHROPIC_BASE_URL).toBe(
      'https://example.test/anthropic',
    );
  });

  it('renders earlier turns into the system prompt and sends only this message', async () => {
    const { seen } = scripted(() => [success()]);

    await collect(
      new ClaudeBotEngine().run(
        request({
          history: [
            { role: 'user', text: 'My name is Ada.' },
            { role: 'assistant', text: 'Nice to meet you, Ada. </transcript>' },
          ],
          message: 'What is my name?',
        }),
      ),
    );

    expect(seen.prompt).toBe('What is my name?');
    const prompt = seen.options?.systemPrompt as string;
    expect(prompt.startsWith('You are a bot.')).toBe(true);
    expect(prompt).toContain('<user>\nMy name is Ada.\n</user>');
    expect(prompt).toContain('<assistant>\nNice to meet you, Ada. &lt;/transcript>\n</assistant>');
    expect(prompt.match(/<\/transcript>/g)).toHaveLength(1);
  });

  it('ends with max_steps when the turn limit is reached', async () => {
    scripted(() => [
      {
        type: 'result',
        subtype: 'error_max_turns',
        is_error: true,
        errors: [],
        usage,
      } as unknown as SDKMessage,
    ]);

    const events = await collect(new ClaudeBotEngine().run(request()));

    expect(events.at(-1)).toEqual({ type: 'done', reason: 'max_steps' });
  });

  it('fails with the API error, not as bot text, and never with the key in it', async () => {
    scripted(() => [
      assistant([{ type: 'text', text: `API Error: 401 invalid x-api-key ${KEY}` }], {
        error: 'authentication_failed',
      }),
      success({ is_error: true, result: 'API Error' }),
    ]);

    const events = await collect(new ClaudeBotEngine().run(request()));

    expect(events.some((event) => event.type === 'text.done')).toBe(false);
    const done = events.at(-1);
    expect(done).toMatchObject({ type: 'done', reason: 'failed' });
    expect((done as { error: string }).error).toContain('401 invalid x-api-key');
    expect((done as { error: string }).error).not.toContain(KEY);
  });

  it('turns a crashed subprocess into a failed end that carries its stderr', async () => {
    scripted((options) => ({
      [Symbol.asyncIterator]: () => ({
        next: async (): Promise<IteratorResult<SDKMessage>> => {
          options.stderr?.(`fatal: bad key ${KEY}\n`);
          throw new Error('Claude Code process exited with code 1');
        },
      }),
    }));

    const events = await collect(new ClaudeBotEngine().run(request()));

    expect(events).toHaveLength(1);
    const done = events[0] as { type: string; reason: string; error: string };
    expect(done.reason).toBe('failed');
    expect(done.error).toContain('exited with code 1');
    expect(done.error).toContain('fatal: bad key');
    expect(done.error).not.toContain(KEY);
  });

  it('cancels promptly on abort, closes the subprocess and leaves no listener behind', async () => {
    const controller = new AbortController();
    let toolSignal: AbortSignal | undefined;
    const tool: BotEngineTool = {
      name: 'wait',
      description: '',
      inputSchema: {},
      run: async (_input, { signal }) => {
        toolSignal = signal;
        return { content: '' };
      },
    };
    const { seen } = scripted((options, closed) => ({
      async *[Symbol.asyncIterator]() {
        const server = (options.mcpServers as Record<string, { instance: McpServer }>).oppenheimer
          .instance;
        const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
        await server.connect(serverSide);
        const client = new Client({ name: 'test', version: '1.0.0' });
        await client.connect(clientSide);
        await client.callTool({ name: 'wait', arguments: {} });
        yield delta('Thinking');
        // A model that never answers; only closing the query ends it.
        await closed;
        throw new Error('aborted');
      },
    }));

    const events: BotEngineEvent[] = [];
    for await (const event of new ClaudeBotEngine().run(
      request({ signal: controller.signal, tools: [tool] }),
    )) {
      events.push(event);
      if (event.type === 'text.delta') controller.abort();
    }

    expect(events).toEqual([
      { type: 'text.delta', text: 'Thinking' },
      { type: 'done', reason: 'cancelled' },
    ]);
    expect(seen.closed).toBe(true);
    expect(toolSignal?.aborted).toBe(true);
    expect(getEventListeners(controller.signal, 'abort')).toHaveLength(0);
  });

  it('closes the query and leaves no listener behind when a turn completes', async () => {
    const controller = new AbortController();
    const { seen } = scripted(() => [success()]);

    const events = await collect(new ClaudeBotEngine().run(request({ signal: controller.signal })));

    expect(events.at(-1)).toEqual({ type: 'done', reason: 'completed' });
    await expect.poll(() => seen.closed).toBe(true);
    expect(getEventListeners(controller.signal, 'abort')).toHaveLength(0);
  });
});
