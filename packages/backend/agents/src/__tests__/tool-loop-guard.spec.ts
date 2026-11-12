/**
 * The guard that stands in for a step limit, through `runTool` as both
 * engines call it: repeated identical failures and calls that keep
 * answering the same thing stop being run; progress is never refused.
 */
import { describe, expect, it } from 'vitest';
import type { BotEngineTool } from '../bot-engine';
import { LOOP_GUARD_DATA_KEY, ToolLoopGuard } from '../tool-loop-guard';
import { runTool } from '../turn';

const KEY = 'sk-test-0123456789';

function tool(answer: () => { content: string; isError?: boolean }): BotEngineTool {
  return {
    name: 'check',
    description: 'Checks',
    inputSchema: { type: 'object' },
    run: async () => answer(),
  };
}

async function callTimes(guard: ToolLoopGuard, target: BotEngineTool, times: number, input = {}) {
  const results = [];
  for (let i = 0; i < times; i++) {
    results.push(
      await runTool(target, input, { signal: new AbortController().signal, apiKey: KEY, guard }),
    );
  }
  return results;
}

describe('ToolLoopGuard through runTool', () => {
  // What breaks this: a turn with no step limit retrying a call that fails the
  // same way forever, paying a model round trip each time.
  it('stops running a call after it failed the same way 3 times in a row', async () => {
    let runs = 0;
    const failing = tool(() => {
      runs += 1;
      return { content: 'permission denied', isError: true };
    });
    const results = await callTimes(new ToolLoopGuard(), failing, 4);
    expect(runs).toBe(3);
    expect(results[3]).toMatchObject({ isError: true, data: { [LOOP_GUARD_DATA_KEY]: 'refused' } });
    expect(results[3]?.content).toContain('failed 3 times in a row');
  });

  it('runs the call again once its input changes', async () => {
    const guard = new ToolLoopGuard();
    const failing = tool(() => ({ content: 'not found', isError: true }));
    await callTimes(guard, failing, 3, { id: 1 });
    const [other] = await callTimes(guard, failing, 1, { id: 2 });
    expect(other?.data).toBeUndefined();
  });

  // What breaks this: polling something that does not move until the turn
  // runs out of money; and, the other way, refusing a poll whose answer moves.
  it('warns, then refuses, a call that keeps answering the same thing', async () => {
    const same = tool(() => ({ content: 'still running' }));
    const results = await callTimes(new ToolLoopGuard(), same, 11);
    expect(results[3]?.content).toBe('still running');
    expect(results[4]?.content).toContain('<loop-guard>');
    expect(results[10]?.data).toEqual({ [LOOP_GUARD_DATA_KEY]: 'refused' });
  });

  it('never refuses a call whose answer changes', async () => {
    let n = 0;
    const moving = tool(() => ({ content: `progress ${n++}` }));
    const results = await callTimes(new ToolLoopGuard(), moving, 15);
    expect(
      results.every((answer) => !answer.isError && !answer.content.includes('loop-guard')),
    ).toBe(true);
  });

  // A screen tool says the same words after every step; what it shows is
  // the answer. Scrolling a long page with one repeated call must run, and
  // the same call on a screen that never changes is still a loop.
  it('reads what a tool shows as part of its answer', async () => {
    let shot = 0;
    const scrolling: BotEngineTool = {
      ...tool(() => ({ content: 'Done.' })),
      run: async () => ({
        content: 'Done.',
        images: [{ mimeType: 'image/jpeg', data: `screen-${shot++}` }],
      }),
    };
    const moving = await callTimes(new ToolLoopGuard(), scrolling, 12);
    expect(moving.every((result) => !result.isError && result.content === 'Done.')).toBe(true);

    const frozen: BotEngineTool = {
      ...scrolling,
      run: async () => ({
        content: 'Done.',
        images: [{ mimeType: 'image/jpeg', data: 'same-screen' }],
      }),
    };
    const stuck = await callTimes(new ToolLoopGuard(), frozen, 12);
    expect(stuck.at(-1)?.isError).toBe(true);
  });

  it('reads the same input however its keys were ordered', async () => {
    const guard = new ToolLoopGuard();
    const failing = tool(() => ({ content: 'nope', isError: true }));
    await callTimes(guard, failing, 2, { a: 1, b: 2 });
    const [third] = await callTimes(guard, failing, 1, { b: 2, a: 1 });
    expect(third?.content).toBe('nope');
    expect(guard.refusal('check', { b: 2, a: 1 })).toContain('failed 3 times');
  });
});
