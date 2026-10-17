/**
 * `BotEngine.complete`, the one tool-less answer the API asks for beside a
 * turn (a conversation's summary): it runs as a turn with no tool of ours or
 * the engine's, no history and one model round trip, answers the text the
 * model wrote, and turns a turn that did not complete into a rejection that
 * carries no key: a `BotRateLimitError` with the reset when the provider
 * refused for rate. The Claude engine's half of "no engine tool" is
 * `claudeOptions` (`claude-options.spec.ts`).
 */
import { describe, expect, it } from 'vitest';
import { type BotCompletionRequest, BotRateLimitError, type BotTurnRequest } from '../bot-engine';
import { FakeBotEngine } from '../fake-bot-engine';

const KEY = 'sk-fake-secret-0123456789';

function request(overrides: Partial<BotCompletionRequest> = {}): BotCompletionRequest {
  return {
    provider: 'glm',
    apiKey: KEY,
    model: 'model-placeholder',
    systemPrompt: 'You summarize.',
    message: 'Summarize this.',
    signal: new AbortController().signal,
    scratchDir: '/unused',
    ...overrides,
  };
}

describe('BotEngine.complete', () => {
  it('runs one round trip with no tools and no history, and answers the text', async () => {
    let seen: BotTurnRequest | undefined;
    const engine = new FakeBotEngine((turn) => {
      seen = turn;
      return [
        { type: 'text.done', text: 'First part.' },
        { type: 'text.done', text: 'Second part.' },
      ];
    });
    expect(await engine.complete(request())).toBe('First part.\n\nSecond part.');
    expect(seen).toMatchObject({
      tools: [],
      history: [],
      engineTools: false,
      maxSteps: 1,
      message: 'Summarize this.',
      systemPrompt: 'You summarize.',
    });
  });

  it('rejects with the reason, without the key, when the turn fails', async () => {
    const engine = new FakeBotEngine(() => [
      { type: 'done', reason: 'failed', error: `401 for key ${KEY}` },
    ]);
    const failure = engine.complete(request());
    await expect(failure).rejects.toThrow('401 for key [redacted]');
  });

  it('rejects a refusal for rate as a BotRateLimitError carrying the reset', async () => {
    const resetAt = new Date('2026-10-15T10:00:00Z');
    const engine = new FakeBotEngine(() => [
      { type: 'done', reason: 'failed', error: '429 too many requests', rateLimit: { resetAt } },
    ]);
    const failure = await engine.complete(request()).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(BotRateLimitError);
    expect(failure).toMatchObject({ message: '429 too many requests', resetAt });
  });

  it('rejects when aborted', async () => {
    const aborted = new AbortController();
    aborted.abort();
    const engine = new FakeBotEngine(() => [{ type: 'text.done', text: 'late' }]);
    await expect(engine.complete(request({ signal: aborted.signal }))).rejects.toThrow(
      'The completion ended cancelled.',
    );
  });
});
