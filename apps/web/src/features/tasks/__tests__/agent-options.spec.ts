import { describe, expect, it } from 'vitest';
import { takesTask, toAgentOptions } from '../lib/agent-options';

/**
 * Start session's whole point is the task: an agent that takes none at launch
 * (Muse, ZCode) would open idle while the task moves to In progress. What
 * breaks this: the picker offering every catalog agent again.
 */
describe('the agents a task can start', () => {
  it('leaves out an agent that cannot receive the task, and keeps the blank terminal', () => {
    const ids = toAgentOptions().map((option) => option.id);
    expect(ids).not.toContain('muse');
    expect(ids).not.toContain('zcode');
    expect(ids).toContain('claude-code');
    expect(ids).toContain('shell');
    expect(takesTask('muse')).toBe(false);
  });
});
