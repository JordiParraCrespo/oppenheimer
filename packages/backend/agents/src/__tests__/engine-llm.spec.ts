/**
 * `engineLlm`, a bot engine behind the `LlmService` contract: what a caller
 * that may run on either model stack (voice's polish) holds instead of both.
 * It must hand the engine the binding's credential and the request's words,
 * refuse what an engine cannot honour rather than drop it, and reject a rate
 * limit as the same `LlmRateLimitError` the deployment's LLM raises.
 */
import { LlmError, LlmRateLimitError } from '@oppenheimer/backend-llm';
import { describe, expect, it } from 'vitest';
import type { BotTurnRequest } from '../bot-engine';
import { engineLlm } from '../engine-llm';
import { FakeBotEngine } from '../fake-bot-engine';

const BINDING = {
  provider: 'chatgpt',
  apiKey: 'access-token',
  accountId: 'account-1',
  model: 'default-model',
  effort: 'low',
} as const;

describe('engineLlm', () => {
  it("completes on the binding's credential, with the request's system and message", async () => {
    let seen: BotTurnRequest | undefined;
    const engine = new FakeBotEngine((turn) => {
      seen = turn;
      return [{ type: 'text.done', text: 'Tidied.' }];
    });
    const llm = engineLlm(engine, BINDING);

    const completion = await llm.complete({
      system: 'Tidy it.',
      messages: [{ role: 'user', content: 'tidy this' }],
      model: 'asked-model',
      timeoutMs: 5_000,
    });

    expect(completion).toEqual({
      text: 'Tidied.',
      model: 'asked-model',
      provider: 'chatgpt',
      finishReason: null,
      usage: null,
    });
    expect(seen).toMatchObject({
      provider: 'chatgpt',
      apiKey: 'access-token',
      accountId: 'account-1',
      model: 'asked-model',
      effort: 'low',
      systemPrompt: 'Tidy it.',
      message: 'tidy this',
    });
    // Which engine needs a directory is the engine's business, not the bridge's.
    expect(seen?.scratchDir).toBeUndefined();
  });

  it("runs on the binding's model when the request names none", async () => {
    let model: string | undefined;
    const engine = new FakeBotEngine((turn) => {
      model = turn.model;
      return [{ type: 'text.done', text: 'ok' }];
    });
    const llm = engineLlm(engine, BINDING);

    expect(llm.defaultModel).toBe('default-model');
    await llm.complete({ messages: [{ role: 'user', content: 'hi' }] });
    expect(model).toBe('default-model');
  });

  it('rejects a refusal for rate as the shared LlmRateLimitError', async () => {
    const resetAt = new Date('2026-10-31T12:00:00Z');
    const engine = new FakeBotEngine(() => [
      { type: 'done', reason: 'failed', error: '429', rateLimit: { resetAt } },
    ]);

    const failure = await engineLlm(engine, BINDING)
      .complete({ messages: [{ role: 'user', content: 'hi' }] })
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(LlmRateLimitError);
    expect(failure).toMatchObject({ code: 'rate_limited', provider: 'chatgpt', resetAt });
  });

  it('refuses temperature and maxTokens before calling, rather than dropping them', async () => {
    let called = false;
    const engine = new FakeBotEngine(() => {
      called = true;
      return [{ type: 'text.done', text: 'ok' }];
    });
    const llm = engineLlm(engine, BINDING);
    const messages = [{ role: 'user' as const, content: 'hi' }];

    await expect(llm.complete({ messages, temperature: 0 })).rejects.toThrow(TypeError);
    await expect(llm.complete({ messages, maxTokens: 10 })).rejects.toThrow(TypeError);
    expect(called).toBe(false);
  });

  it('is not configured without a credential, and refuses before calling', async () => {
    let called = false;
    const engine = new FakeBotEngine(() => {
      called = true;
      return [];
    });
    const llm = engineLlm(engine, { ...BINDING, apiKey: '' });

    expect(llm.isConfigured()).toBe(false);
    const failure = await llm
      .complete({ messages: [{ role: 'user', content: 'hi' }] })
      .catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(LlmError);
    expect(failure).toMatchObject({ code: 'not_configured' });
    expect(called).toBe(false);
  });
});
