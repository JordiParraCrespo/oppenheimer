/**
 * One real turn on the Claude engine against z.ai's GLM endpoint: the
 * subprocess starts with our environment, calls our tool through the
 * in-process MCP server, streams text and ends completed. Skipped unless
 * GLM_API_KEY is set; the model comes from GLM_MODEL, else the one below.
 */
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { BotEngineEvent, BotEngineTool } from '../bot-engine';
import { createBotEngine } from '../bot-engine.factory';

const apiKey = process.env.GLM_API_KEY;
const model = process.env.GLM_MODEL ?? 'glm-5.3';

describe.skipIf(!apiKey)('Claude engine on GLM (live)', () => {
  it('calls a tool and answers with its result', { timeout: 180_000 }, async () => {
    const scratchDir = await mkdtemp(join(tmpdir(), 'bot-engine-live-'));
    const getTime: BotEngineTool = {
      name: 'get_time',
      description: 'Returns the current time.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      run: async () => ({ content: 'It is 13:37 on the dot.' }),
    };
    const events: BotEngineEvent[] = [];
    try {
      for await (const event of createBotEngine().run({
        provider: 'glm',
        apiKey: apiKey as string,
        model,
        systemPrompt: 'You are a terse assistant. Use your tools when asked.',
        history: [],
        message: 'Call the get_time tool, then reply with exactly what it returned.',
        tools: [getTime],
        effort: 'high',
        maxSteps: 5,
        signal: AbortSignal.timeout(170_000),
        scratchDir,
      })) {
        events.push(event);
      }
    } finally {
      await rm(scratchDir, { recursive: true, force: true });
    }

    process.stderr.write(`[live ${model}] ${events.map((event) => event.type).join(' ')}\n`);
    const done = events.at(-1);
    expect(done, JSON.stringify(done)).toEqual({ type: 'done', reason: 'completed' });
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'tool.started', name: 'get_time' }),
    );
    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'tool.finished',
        name: 'get_time',
        output: 'It is 13:37 on the dot.',
        isError: false,
      }),
    );
    const text = events
      .filter((event) => event.type === 'text.done')
      .map((event) => (event as { text: string }).text)
      .join('');
    expect(text).toContain('13:37');
  });
});
