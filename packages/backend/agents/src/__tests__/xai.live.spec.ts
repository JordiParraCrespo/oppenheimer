/**
 * One real turn on the OpenAI engine against xAI's Responses API: it calls
 * our tool, streams text and ends completed. Skipped unless XAI_API_KEY is
 * set; the model comes from XAI_MODEL, else the one below.
 */
import { describe, expect, it } from 'vitest';
import type { BotEngineEvent, BotEngineTool } from '../bot-engine';
import { createBotEngine } from '../bot-engine.factory';

const apiKey = process.env.XAI_API_KEY;
const model = process.env.XAI_MODEL ?? 'grok-4.7';

describe.skipIf(!apiKey)('OpenAI engine on xAI (live)', () => {
  it('calls a tool and answers with its result', { timeout: 180_000 }, async () => {
    const getTime: BotEngineTool = {
      name: 'get_time',
      description: 'Returns the current time.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      run: async () => ({ content: 'It is 13:37 on the dot.' }),
    };
    const events: BotEngineEvent[] = [];
    for await (const event of createBotEngine().run({
      provider: 'xai',
      apiKey: apiKey as string,
      model,
      systemPrompt: 'You are a terse assistant. Use your tools when asked.',
      history: [],
      message: 'Call the get_time tool, then reply with exactly what it returned.',
      tools: [getTime],
      effort: model === 'grok-4.7' ? 'low' : null,
      maxSteps: 5,
      signal: AbortSignal.timeout(170_000),
      scratchDir: '/unused',
    })) {
      events.push(event);
    }

    process.stderr.write(`[live ${model}] ${events.map((event) => event.type).join(' ')}\n`);
    const done = events.at(-1);
    expect(done, JSON.stringify(done)).toEqual({ type: 'done', reason: 'completed' });
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
