import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  OpenAiCompatibleSessionNamerAdapter,
  titleFrom,
} from '../openai-compatible-session-namer.adapter';
import type { SessionNamerConfig } from '../session-namer.config';
import { SESSION_NAME_MAX_LENGTH } from '../session-namer.port';

/**
 * One adapter for every server that speaks OpenAI's chat-completions shape, so
 * what is tested here is what differs between them rather than one vendor's
 * contract: the URL it builds, whether a key is sent at all, and that an answer
 * in a shape nobody expected reads as "no title" instead of throwing on a path
 * nobody awaits.
 *
 * As with the Anthropic namer: a session that cannot be named keeps the slug it
 * was minted with, so **nothing here throws**.
 */

function config(overrides: Partial<SessionNamerConfig> = {}): SessionNamerConfig {
  return {
    provider: 'openai-compatible',
    model: 'a-model-id',
    baseUrl: 'https://api.groq.test/openai/v1',
    apiKey: 'gsk-test',
    isConfigured: true,
    ...overrides,
  } as SessionNamerConfig;
}

function answering(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  return vi.fn().mockResolvedValue({
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => body,
  });
}

const CHOICE = (content: string) => ({ choices: [{ message: { role: 'assistant', content } }] });

describe('the OpenAI-compatible session namer', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('asks the configured server and returns its title', async () => {
    const fetchDouble = answering(CHOICE('Fix the wallet list empty state'));
    vi.stubGlobal('fetch', fetchDouble);

    const name = await new OpenAiCompatibleSessionNamerAdapter(config()).nameFor(
      'the wallet list shows nothing when there are no wallets',
    );

    expect(name).toBe('Fix the wallet list empty state');
    const [url, init] = fetchDouble.mock.calls[0];
    expect(url).toBe('https://api.groq.test/openai/v1/chat/completions');
    expect(init.headers.authorization).toBe('Bearer gsk-test');
    expect(JSON.parse(init.body).model).toBe('a-model-id');
  });

  it('does not double the slash when the base URL carries one', async () => {
    const fetchDouble = answering(CHOICE('A title'));
    vi.stubGlobal('fetch', fetchDouble);

    await new OpenAiCompatibleSessionNamerAdapter(
      config({ baseUrl: 'http://localhost:11434/v1/' } as Partial<SessionNamerConfig>),
    ).nameFor('something');

    expect(fetchDouble.mock.calls[0][0]).toBe('http://localhost:11434/v1/chat/completions');
  });

  /**
   * The case this adapter exists for: a model on the person's own machine, which
   * wants no key. A blank `Authorization: Bearer` header is rejected by some
   * servers, so the header is absent rather than empty.
   */
  it('sends no authorization header to a server that wants no key', async () => {
    const fetchDouble = answering(CHOICE('A title'));
    vi.stubGlobal('fetch', fetchDouble);

    await new OpenAiCompatibleSessionNamerAdapter(
      config({ apiKey: undefined } as Partial<SessionNamerConfig>),
    ).nameFor('something');

    expect(fetchDouble.mock.calls[0][1].headers.authorization).toBeUndefined();
  });

  it('keeps the slug when the server refuses, rather than throwing', async () => {
    vi.stubGlobal('fetch', answering({}, { ok: false, status: 429 }));

    await expect(
      new OpenAiCompatibleSessionNamerAdapter(config()).nameFor('something'),
    ).resolves.toBeNull();
  });

  it('keeps the slug when the server cannot be reached', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:11434')),
    );

    await expect(
      new OpenAiCompatibleSessionNamerAdapter(config()).nameFor('something'),
    ).resolves.toBeNull();
  });

  it('asks nothing at all when the deployment is not configured', async () => {
    const fetchDouble = answering(CHOICE('A title'));
    vi.stubGlobal('fetch', fetchDouble);

    const adapter = new OpenAiCompatibleSessionNamerAdapter(
      config({ baseUrl: undefined } as Partial<SessionNamerConfig>),
    );

    await expect(adapter.nameFor('something')).resolves.toBeNull();
    expect(fetchDouble).not.toHaveBeenCalled();
  });

  it('asks nothing for an empty prompt', async () => {
    const fetchDouble = answering(CHOICE('A title'));
    vi.stubGlobal('fetch', fetchDouble);

    await expect(
      new OpenAiCompatibleSessionNamerAdapter(config()).nameFor('   '),
    ).resolves.toBeNull();
    expect(fetchDouble).not.toHaveBeenCalled();
  });
});

describe('titleFrom', () => {
  it('reads the first choice of a well-formed answer', () => {
    expect(titleFrom(CHOICE('Fix the wallet list'))).toBe('Fix the wallet list');
  });

  it('unquotes a title a model quoted, and drops a trailing stop', () => {
    expect(titleFrom(CHOICE('"Fix the wallet list."'))).toBe('Fix the wallet list');
  });

  /**
   * The open-weights models this adapter is for are the ones that answer with a
   * reasoning block. Dropping it is the difference between a name and forty
   * characters of the model thinking out loud.
   */
  it('drops a reasoning block rather than naming the session after it', () => {
    expect(titleFrom(CHOICE('<think>The user wants a title.</think>\nFix the wallet list'))).toBe(
      'Fix the wallet list',
    );
  });

  it('skips blank lines before the title', () => {
    expect(titleFrom(CHOICE('\n\n  Fix the wallet list  '))).toBe('Fix the wallet list');
  });

  it('caps the title at what a sidebar row can show', () => {
    const long = 'A'.repeat(SESSION_NAME_MAX_LENGTH + 20);
    expect(titleFrom(CHOICE(long))).toHaveLength(SESSION_NAME_MAX_LENGTH);
  });

  it('reads a shape nobody expected as no title', () => {
    expect(titleFrom(null)).toBeNull();
    expect(titleFrom({})).toBeNull();
    expect(titleFrom({ choices: 'not an array' })).toBeNull();
    expect(titleFrom({ choices: [] })).toBeNull();
    expect(titleFrom({ choices: [{}] })).toBeNull();
    expect(titleFrom({ choices: [{ message: { content: 42 } }] })).toBeNull();
    expect(titleFrom(CHOICE('   '))).toBeNull();
  });
});
