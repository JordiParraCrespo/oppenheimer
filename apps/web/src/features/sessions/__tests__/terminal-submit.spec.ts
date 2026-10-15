import { describe, expect, it } from 'vitest';
import { SUBMIT_AFTER_MS, submitLine } from '../lib/terminal-submit';

/**
 * A line from the composer under a terminal reaches the agent as typed and
 * submitted: the text and its Enter go out as two writes, the Enter after a
 * pause, never one write an agent would read as a paste.
 */
describe('submitting a composed line', () => {
  it('sends the text, then Enter on its own write after the pause', () => {
    const writes: string[] = [];
    const scheduled: { run: () => void; ms: number }[] = [];
    submitLine(
      (data) => writes.push(data),
      'what changed?',
      (run, ms) => scheduled.push({ run, ms }),
    );
    expect(writes).toEqual(['what changed?']);
    expect(scheduled.map((entry) => entry.ms)).toEqual([SUBMIT_AFTER_MS]);
    scheduled[0]?.run();
    expect(writes).toEqual(['what changed?', '\r']);
  });
});
