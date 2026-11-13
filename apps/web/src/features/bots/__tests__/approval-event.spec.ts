import type { BotMessageEntity } from '@oppenheimer/frontend-consumer';
import { describe, expect, it } from 'vitest';
import { approvalLineKey, runningApprovedCalls, showsApprovalLine } from '../lib/approval-event';

/** How the chat reads an approved call's two lines: the yes while it runs, then how it went. */

const since = new Date('2026-11-02T10:00:00Z');
const approval = (turnId: string, stage?: 'started' | 'finished', outcome = 'approved') =>
  ({
    id: `${turnId}-line`,
    turnId,
    role: 'event',
    createdAt: since,
    event: {
      kind: 'approval',
      outcome,
      tool: 'archive_mail',
      summary: 'Archive 25 threads',
      sessionId: null,
      approvalId: 'a1',
      ...(stage && { stage }),
    },
  }) as BotMessageEntity;

describe('runningApprovedCalls', () => {
  // What breaks this: the chat goes quiet between the bot's "on it" and its
  // report, or keeps a call spinning after the report landed.
  it('holds the call a yes started under its turn until the line that reports it is in the chat', () => {
    const started = approval('t1', 'started');
    expect([...runningApprovedCalls([started])]).toEqual([
      ['t1', { summary: 'Archive 25 threads', since }],
    ]);
    expect(runningApprovedCalls([started, approval('t2', 'finished')]).size).toBe(0);
    // A line from before the call had two is never running.
    expect(runningApprovedCalls([approval('t1')]).size).toBe(0);
  });
});

describe('approvalLineKey', () => {
  it('reads the yes and the no as decided, and the report as how the call went', () => {
    const line = (stage?: 'started' | 'finished', outcome = 'approved') => {
      const { event } = approval('t', stage, outcome);
      if (event?.kind !== 'approval') throw new Error('not an approval');
      return approvalLineKey(event);
    };
    expect(line('started')).toBe('approved');
    expect(line(undefined, 'denied')).toBe('denied');
    expect(line('finished')).toBe('finished');
    expect(line('finished', 'failed')).toBe('finishedFailed');
  });
});

describe('showsApprovalLine', () => {
  // What breaks this: every yes and every "Done" crowds the chat while the
  // wrench is off, or a denial or a failure disappears with them.
  it('hides a call that went through unless the tool calls are shown or it started a session', () => {
    const line = (
      outcome: string,
      stage?: 'started' | 'finished',
      sessionId: string | null = null,
    ) => {
      const { event } = approval('t', stage, outcome);
      if (event?.kind !== 'approval') throw new Error('not an approval');
      return { ...event, sessionId };
    };
    expect(showsApprovalLine(line('approved', 'started'), false)).toBe(false);
    expect(showsApprovalLine(line('approved', 'finished'), false)).toBe(false);
    expect(showsApprovalLine(line('approved', 'started'), true)).toBe(true);
    expect(showsApprovalLine(line('approved', 'started', 's1'), false)).toBe(true);
    expect(showsApprovalLine(line('denied'), false)).toBe(true);
    expect(showsApprovalLine(line('stopped'), false)).toBe(true);
    expect(showsApprovalLine(line('failed', 'finished'), false)).toBe(true);
  });
});
