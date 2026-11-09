/**
 * Mid-turn compaction for the OpenAI engines, on plain items: where a fold
 * may cut, how a fold updates the last summary, and that a failed summary
 * sends the call unchanged. `openai-responses.spec.ts` proves it is wired
 * into the real Agents SDK.
 */
import { describe, expect, it } from 'vitest';
import type { BotCompletion } from '../../bot-engine';
import { compactionThreshold } from '../../bot-engine';
import { type CompactableItem, compactionCut, TurnCompactor } from '../openai-compaction';

const big = (label: string) => `${label} `.repeat(400);

function message(role: string, text: string): CompactableItem {
  return { type: 'message', role, content: text };
}
function call(id: string): CompactableItem {
  return { type: 'function_call', callId: id, name: 'get', arguments: '{}' };
}
function result(id: string, text = 'ok'): CompactableItem {
  return { type: 'function_call_result', callId: id, name: 'get', output: { type: 'text', text } };
}

describe('compactionThreshold', () => {
  // What breaks this: a turn on a large-window model compacting only near
  // its whole window, so every call of a long turn carries up to a million tokens.
  it('takes 70% of the model window, capped at the bot window', () => {
    expect(compactionThreshold(1_000_000)).toBe(89_600);
    expect(compactionThreshold(null)).toBe(89_600);
    expect(compactionThreshold(100_000)).toBe(70_000);
  });
});

describe('compactionCut', () => {
  // What breaks this: a fold that sends a tool result without its call, which
  // the Responses API refuses, failing the turn at the moment it compacts.
  it('never starts the kept part between a call and its result', () => {
    const items = [
      message('user', big('old')),
      call('a'),
      call('b'),
      result('a', big('answer')),
      result('b'),
    ];
    expect(compactionCut(items, 0, 10)).toBe(1);
  });

  it('cuts inside a turn made only of tool calls', () => {
    const items = [
      message('user', 'start'),
      call('a'),
      result('a', big('first')),
      call('b'),
      result('b', 'small'),
    ];
    expect(compactionCut(items, 0, 50)).toBe(3);
  });

  // What breaks this: a fold that keeps a model's message and call but drops
  // the reasoning item before them, which a reasoning model's API refuses.
  it('never parts a call from the reasoning of its response', () => {
    const items = [
      message('user', 'start'),
      call('a'),
      result('a', big('first')),
      { type: 'reasoning', id: 'r2' },
      message('assistant', 'Checking the next one'),
      call('b'),
      result('b'),
    ];
    expect(compactionCut(items, 0, 5)).toBe(3);
  });

  it('does not start after a reasoning item, away from what it produced', () => {
    const items = [
      message('user', big('old')),
      { type: 'reasoning', id: 'r1' },
      call('a'),
      result('a'),
    ];
    expect(compactionCut(items, 0, 5)).toBe(1);
  });
});

describe('TurnCompactor', () => {
  // What breaks this: long tool answers counted short, so an OpenAI turn
  // reaches its provider's context limit before it ever compacts.
  it('counts a long tool answer in full against the threshold', async () => {
    let asked = 0;
    const compactor = new TurnCompactor<CompactableItem>(5_000, 0, async () => {
      asked += 1;
      return { text: 'summary', usage: null };
    });
    const answer = 'x'.repeat(12_000);
    const items = [
      message('user', 'the ask'),
      call('a'),
      result('a', answer),
      call('b'),
      result('b', answer),
    ];
    await compactor.filter({ input: items });
    expect(asked).toBe(1);
  });

  const completion = (text: string): BotCompletion => ({
    text,
    usage: { inputTokens: 100, outputTokens: 10, cacheReadTokens: 0, cacheWriteTokens: 0 },
  });

  // What breaks this: a second fold that summarizes only what came after the
  // first and drops what the first summary held.
  it('updates the last summary on the next fold, and keeps the turn message', async () => {
    const prompts: string[] = [];
    const compactor = new TurnCompactor<CompactableItem>(400, 1, async (prompt) => {
      prompts.push(prompt);
      return completion(`summary ${prompts.length}`);
    });
    const items = [message('user', big('history')), message('user', 'the ask')];
    const first = await compactor.filter({ input: items });
    expect(first.input).toHaveLength(2);
    expect(JSON.stringify(first.input[0])).toContain('summary 1');
    expect(first.input[1]).toBe(items[1]);
    expect(compactor.take().map((event) => event.type)).toEqual(['usage', 'compacted']);

    items.push(call('a'), result('a', big('long answer')), message('assistant', 'next'));
    const second = await compactor.filter({ input: items });
    expect(prompts[1]).toContain('<previous-summary>\nsummary 1');
    expect(JSON.stringify(second.input[0])).toContain('summary 2');
    expect(second.input).toContain(items[1]);
    expect(JSON.stringify(second.input)).not.toContain('long answer');
  });

  it('sends the call as it was when the summary fails, and tries again on the next', async () => {
    let calls = 0;
    const compactor = new TurnCompactor<CompactableItem>(400, 1, async () => {
      calls += 1;
      if (calls === 1) throw new Error('rate limited');
      return completion('summary');
    });
    const items = [message('user', big('history')), message('user', 'the ask')];
    expect((await compactor.filter({ input: items })).input).toEqual(items);
    expect(compactor.take()).toEqual([]);
    expect(JSON.stringify((await compactor.filter({ input: items })).input)).toContain('summary');
  });

  it('leaves a call under its threshold alone', async () => {
    const compactor = new TurnCompactor<CompactableItem>(10_000, 0, async () => {
      throw new Error('not asked');
    });
    const items = [message('user', 'hello')];
    expect((await compactor.filter({ input: items })).input).toEqual(items);
  });
});
