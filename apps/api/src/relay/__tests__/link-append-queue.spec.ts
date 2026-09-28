import type { EventsAppendMessage } from '@oppenheimer/shared/protocol';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  type AppendQueueLimits,
  type AppendRun,
  LinkAppendQueue,
} from '../infrastructure/link-append-queue.util';

const LIMITS: AppendQueueLimits = {
  pauseAt: 4,
  resumeAt: 1,
  closeAt: 8,
  maxPauseMs: 1_000,
  maxEventsPerAppend: 5,
};

function batch(batchId: string, sessionId = 's1', events = 1): EventsAppendMessage {
  return {
    type: 'events.append',
    batchId,
    sessionId,
    events: Array.from({ length: events }, (_, n) => ({
      idempotencyKey: `${batchId}:${n}`,
      kind: 'agent.observed',
      payload: '{}',
      occurredAt: '2026-09-28T10:00:00.000Z',
    })),
  };
}

/** A queue whose appends wait until released, so the test decides when the database answers. */
function setup(limits = LIMITS) {
  const runs: string[][] = [];
  const gates: (() => void)[] = [];
  const flow = { pause: vi.fn(), resume: vi.fn(), overflow: vi.fn() };
  const queue = new LinkAppendQueue(
    (run: AppendRun) => {
      runs.push(run.map((each) => each.batchId));
      return new Promise<void>((resolve) => gates.push(resolve));
    },
    flow,
    limits,
  );
  /** Let the append in flight finish, and give the worker a turn to take the next. */
  const release = async () => {
    gates.shift()?.();
    await new Promise((resolve) => setImmediate(resolve));
  };
  return { queue, flow, runs, release };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('LinkAppendQueue', () => {
  it('applies batches one at a time, in the order they arrived', async () => {
    const { queue, runs, release } = setup();
    queue.push(batch('b1', 's1'));
    queue.push(batch('b2', 's2'));
    queue.push(batch('b3', 's1'));
    expect(runs).toEqual([['b1']]);
    await release();
    expect(runs).toEqual([['b1'], ['b2']]);
    await release();
    expect(runs).toEqual([['b1'], ['b2'], ['b3']]);
  });

  it('coalesces the batches queued right behind one for the same session', async () => {
    const { queue, runs, release } = setup();
    queue.push(batch('b1'));
    queue.push(batch('b2'));
    queue.push(batch('b3'));
    await release();
    expect(runs).toEqual([['b1'], ['b2', 'b3']]);
  });

  it('ends a run at the first batch for another session, so order across sessions holds', async () => {
    const { queue, runs, release } = setup({ ...LIMITS, pauseAt: 100, closeAt: 200 });
    queue.push(batch('b0'));
    queue.push(batch('a1', 's1'));
    queue.push(batch('a2', 's1'));
    queue.push(batch('x1', 's2'));
    queue.push(batch('a3', 's1'));
    await release();
    await release();
    await release();
    expect(runs).toEqual([['b0'], ['a1', 'a2'], ['x1'], ['a3']]);
  });

  it('never coalesces past the protocol’s events per batch', async () => {
    const { queue, runs, release } = setup({ ...LIMITS, pauseAt: 100, closeAt: 200 });
    queue.push(batch('b0'));
    queue.push(batch('b1', 's1', 3));
    queue.push(batch('b2', 's1', 2));
    queue.push(batch('b3', 's1', 1));
    await release();
    await release();
    expect(runs).toEqual([['b0'], ['b1', 'b2'], ['b3']]);
  });

  it('pauses at the high-water mark and resumes at the low one', async () => {
    const { queue, flow, release } = setup();
    queue.push(batch('b0', 's0'));
    // b0 is in flight; four more wait, each for its own session.
    for (const n of [1, 2, 3, 4]) queue.push(batch(`b${n}`, `s${n}`));
    expect(queue.size).toBe(4);
    expect(flow.pause).toHaveBeenCalledTimes(1);
    expect(queue.paused).toBe(true);

    await release(); // takes b1: three wait
    await release(); // takes b2: two wait
    expect(flow.resume).not.toHaveBeenCalled();
    await release(); // takes b3: one waits, the low-water mark
    expect(flow.resume).toHaveBeenCalledTimes(1);
    expect(queue.paused).toBe(false);
    expect(flow.overflow).not.toHaveBeenCalled();
  });

  it('gives up on a pause that outlasts the maximum', async () => {
    vi.useFakeTimers();
    const { queue, flow } = setup();
    for (const n of [0, 1, 2, 3, 4]) queue.push(batch(`b${n}`, `s${n}`));
    expect(queue.paused).toBe(true);
    vi.advanceTimersByTime(LIMITS.maxPauseMs - 1);
    expect(flow.overflow).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(flow.overflow).toHaveBeenCalledWith('paused_too_long');
    expect(queue.size).toBe(0);
  });

  it('does not give up on a pause that ended in time', async () => {
    // Only the pause's timer is faked; the worker's turns stay real.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { queue, flow, release } = setup();
    for (const n of [0, 1, 2, 3, 4]) queue.push(batch(`b${n}`, `s${n}`));
    await release();
    await release();
    await release();
    expect(queue.paused).toBe(false);
    vi.advanceTimersByTime(LIMITS.maxPauseMs * 2);
    expect(flow.overflow).not.toHaveBeenCalled();
  });

  it('never holds more than the ceiling: frames read before the pause close the link', () => {
    const { queue, flow } = setup();
    for (let n = 0; n <= LIMITS.closeAt; n += 1) queue.push(batch(`b${n}`, `s${n}`));
    expect(flow.overflow).toHaveBeenCalledWith('queue_full');
    expect(flow.overflow).toHaveBeenCalledTimes(1);
    // Disposed: what was waiting is dropped (the runner resends it) and nothing more is taken.
    expect(queue.size).toBe(0);
    queue.push(batch('late'));
    expect(queue.size).toBe(0);
  });

  it('keeps going after an append that fails', async () => {
    const runs: string[] = [];
    const queue = new LinkAppendQueue(
      async (run) => {
        runs.push(run[0].batchId);
        if (run[0].batchId === 'b1') throw new Error('database gone');
      },
      { pause: vi.fn(), resume: vi.fn(), overflow: vi.fn() },
      LIMITS,
    );
    queue.push(batch('b1', 's1'));
    queue.push(batch('b2', 's2'));
    await vi.waitFor(() => expect(runs).toEqual(['b1', 'b2']));
  });
});
