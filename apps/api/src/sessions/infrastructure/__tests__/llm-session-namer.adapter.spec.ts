import { LlmError, type LlmService } from '@oppenheimer/backend-llm';
import { describe, expect, it, vi } from 'vitest';
import { LlmSessionNamerAdapter } from '../llm-session-namer.adapter';
import type { SessionNamerConfig } from '../session-namer.config';

/**
 * The adapter's job is the request and the budget, not the provider: which
 * vendor answers is `@oppenheimer/backend-llm`'s concern and is tested there.
 * What is tested here is that the deadline is passed down, the answer is
 * cleaned, and **nothing throws** — the caller has a fallback for `null`.
 */
function config(overrides: { isConfigured?: boolean } = {}): SessionNamerConfig {
  return {
    model: 'a-small-model',
    timeoutMs: 1_500,
    isConfigured: true,
    ...overrides,
  } as SessionNamerConfig;
}

function llm(complete: LlmService['complete']): LlmService {
  return { complete: vi.fn(complete) } as unknown as LlmService;
}

const answer = (text: string) => async () => ({
  text,
  model: 'a-small-model',
  provider: 'openrouter' as const,
  finishReason: 'stop',
  usage: null,
});

describe('LlmSessionNamerAdapter', () => {
  it('asks the configured model within the naming deadline', async () => {
    const client = llm(answer('Fix the wallet list empty state'));

    const name = await new LlmSessionNamerAdapter(client, config()).nameFor(
      'the wallet list shows nothing when there are no wallets',
    );

    expect(name).toBe('Fix the wallet list empty state');
    expect(client.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'a-small-model',
        timeoutMs: 1_500,
        temperature: 0,
        messages: [
          { role: 'user', content: 'the wallet list shows nothing when there are no wallets' },
        ],
      }),
    );
  });

  it('cleans what the model answered', async () => {
    const name = await new LlmSessionNamerAdapter(
      llm(answer('<think>ok</think>\n"Add dark mode."')),
      config(),
    ).nameFor('add dark mode');
    expect(name).toBe('Add dark mode');
  });

  it('answers null when the model is not quick enough, rather than throwing', async () => {
    const client = llm(async () => {
      throw new LlmError('timeout', 'openrouter', 'openrouter did not answer within 1500ms');
    });
    await expect(
      new LlmSessionNamerAdapter(client, config()).nameFor('anything'),
    ).resolves.toBeNull();
  });

  it('makes no call when no model names sessions here', async () => {
    const client = llm(answer('never'));
    const name = await new LlmSessionNamerAdapter(client, config({ isConfigured: false })).nameFor(
      'anything',
    );
    expect(name).toBeNull();
    expect(client.complete).not.toHaveBeenCalled();
  });

  it('caps what it sends of a very long prompt', async () => {
    const client = llm(answer('A title'));
    await new LlmSessionNamerAdapter(client, config()).nameFor('x'.repeat(10_000));
    const [request] = vi.mocked(client.complete).mock.calls[0];
    expect(request.messages[0].content).toHaveLength(2_000);
  });
});
