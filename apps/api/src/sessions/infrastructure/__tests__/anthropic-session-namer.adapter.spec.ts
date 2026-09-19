import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AnthropicSessionNamerAdapter, titleFrom } from '../anthropic-session-namer.adapter';
import type { SessionNamerConfig } from '../session-namer.config';
import { SESSION_NAME_MAX_LENGTH } from '../session-namer.port';

/**
 * The namer is best-effort by design: a session that cannot be named keeps the slug
 * it was minted with, which reads fine and costs nothing. So most of what matters
 * here is that **nothing throws** — a title is never worth failing a request over —
 * and that the one line leaving the host goes out with the right headers.
 */

function config(overrides: Partial<SessionNamerConfig> = {}): SessionNamerConfig {
  return {
    provider: 'anthropic',
    model: 'a-model-id',
    anthropicApiKey: 'sk-test',
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

const TEXT = (text: string) => ({ content: [{ type: 'text', text }] });

describe('the Anthropic session namer', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('asks the configured model and returns its title', async () => {
    const fetchDouble = answering(TEXT('Fix the wallet list empty state'));
    vi.stubGlobal('fetch', fetchDouble);

    const name = await new AnthropicSessionNamerAdapter(config()).nameFor(
      'the wallet list shows nothing when there are no wallets',
    );

    expect(name).toBe('Fix the wallet list empty state');
    const [url, request] = fetchDouble.mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    // The three headers this endpoint requires. `anthropic-version` is a date, and
    // omitting it is a 400 rather than a default.
    expect(request.headers['x-api-key']).toBe('sk-test');
    expect(request.headers['anthropic-version']).toBe('2023-06-01');
    expect(JSON.parse(request.body).model).toBe('a-model-id');
  });

  it('keeps the slug when the provider refuses', async () => {
    vi.stubGlobal('fetch', answering({}, { ok: false, status: 429 }));
    await expect(
      new AnthropicSessionNamerAdapter(config()).nameFor('anything'),
    ).resolves.toBeNull();
  });

  it('keeps the slug when the call throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('timed out')));
    await expect(
      new AnthropicSessionNamerAdapter(config()).nameFor('anything'),
    ).resolves.toBeNull();
  });

  it('does not call out at all without a key or a model', async () => {
    const fetchDouble = answering(TEXT('unused'));
    vi.stubGlobal('fetch', fetchDouble);

    const namer = new AnthropicSessionNamerAdapter(
      config({ anthropicApiKey: undefined, isConfigured: false }),
    );
    await expect(namer.nameFor('anything')).resolves.toBeNull();
    expect(namer.isConfigured()).toBe(false);
    expect(fetchDouble).not.toHaveBeenCalled();
  });

  it('does not call out for an empty prompt', async () => {
    const fetchDouble = answering(TEXT('unused'));
    vi.stubGlobal('fetch', fetchDouble);
    await expect(new AnthropicSessionNamerAdapter(config()).nameFor('   ')).resolves.toBeNull();
    expect(fetchDouble).not.toHaveBeenCalled();
  });
});

describe('reading the title out of an answer', () => {
  it('takes the first line and strips the quotes a model likes to add', () => {
    expect(titleFrom(TEXT('"Fix the wallet list"\nand here is why'))).toBe('Fix the wallet list');
  });

  it('caps the title at what a sidebar row can show', () => {
    const long = 'x'.repeat(200);
    expect(titleFrom(TEXT(long))).toHaveLength(SESSION_NAME_MAX_LENGTH);
  });

  it('reads a shape it does not recognise as no title', () => {
    // Narrowed once, here, so nothing downstream casts — and an unexpected body is
    // the same outcome as a failed call.
    expect(titleFrom(null)).toBeNull();
    expect(titleFrom({ content: 'not an array' })).toBeNull();
    expect(titleFrom({ content: [{ type: 'text' }] })).toBeNull();
    expect(titleFrom(TEXT('   '))).toBeNull();
  });
});
