/**
 * One real turn on the Claude engine against Anthropic's API with an
 * advisor: the model consults it and the turn's usage reports what it spent
 * apart, on its own model. What breaks this: a Claude Code upgrade that
 * renames or drops the gate the engine opens (`ADVISOR_GATE`), after which
 * every bot's advisor is silently off. Skipped unless ANTHROPIC_API_KEY is
 * set; the models come from ADVISOR_LIVE_MODEL and ADVISOR_LIVE_ADVISOR,
 * else the pair below, which must be one the catalog lists.
 */
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { BotEngineEvent } from '../bot-engine';
import { createBotEngine } from '../bot-engine.factory';

const apiKey = process.env.ANTHROPIC_API_KEY;
const model = process.env.ADVISOR_LIVE_MODEL ?? 'claude-sonnet-5-5';
const advisorModel = process.env.ADVISOR_LIVE_ADVISOR ?? 'claude-opus-5-5';

describe.skipIf(!apiKey)('Claude engine with an advisor (live)', () => {
  it('consults the advisor and reports its spend on its own model', {
    timeout: 180_000,
  }, async () => {
    const scratchDir = await mkdtemp(join(tmpdir(), 'bot-engine-advisor-'));
    const events: BotEngineEvent[] = [];
    try {
      for await (const event of createBotEngine().run({
        provider: 'anthropic',
        apiKey: apiKey as string,
        model,
        advisorModel,
        systemPrompt: 'You are a terse assistant.',
        history: [],
        message:
          'Before answering, consult your advisor once about the approach. Then answer in one sentence: what is a good name for a bot that triages email?',
        tools: [],
        maxSteps: 4,
        signal: AbortSignal.timeout(170_000),
        scratchDir,
      })) {
        events.push(event);
      }
    } finally {
      await rm(scratchDir, { recursive: true, force: true });
    }

    const usage = events.find((event) => event.type === 'usage');
    process.stderr.write(`[live ${model} + ${advisorModel}] ${JSON.stringify(usage)}\n`);
    expect(events.at(-1)).toEqual({ type: 'done', reason: 'completed' });
    expect(usage).toMatchObject({ advisor: { model: advisorModel } });
  });
});
