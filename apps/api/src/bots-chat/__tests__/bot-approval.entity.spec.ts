import { BotApprovalEntity } from '../domain/bot-approval.entity';
import {
  approvalEvent,
  approvalEventOf,
  approvalResolved,
  decisionOf,
  stoppedLine,
} from '../domain/bot-approval.policy';
import { BotApprovalChangedDomainEvent } from '../domain/events/bot-approval-changed.domain-event';

/**
 * A Needs input card is decided once (`25-bots.md` §5): pending moves to
 * approved, denied or expired and never again; only an approved call records
 * what it answered, and an error ends it failed. The event the bot is then
 * told says who decided, what, and what came of it.
 */
const NOW = new Date('2026-10-15T10:00:00Z');

function pending(
  summary = 'Start Claude Code on build-02',
  extra: Partial<Parameters<typeof BotApprovalEntity.request>[0]> = {},
) {
  return BotApprovalEntity.request({
    organizationId: 'org-1',
    botId: 'bot-1',
    turnId: 'turn-1',
    tool: 'start_session',
    input: { task: 'Fix it' },
    summary,
    ...extra,
  });
}

/** What the workspace stream is told: without it the Inbox learns of a card only on a poll. */
function announced(approval: BotApprovalEntity) {
  return approval.domainEvents
    .filter((event) => event instanceof BotApprovalChangedDomainEvent)
    .map((event) => (event as BotApprovalChangedDomainEvent).status);
}

describe('BotApprovalEntity', () => {
  it('announces each move to its workspace: raised, decided, expired, run', () => {
    const approval = pending();
    expect(approval.domainEvents[0]).toMatchObject({
      aggregateId: approval.id,
      organizationId: 'org-1',
      botId: 'bot-1',
    });
    approval.approve('user-1', NOW);
    approval.recordResult('Started session s-1', false);
    expect(announced(approval)).toEqual(['pending', 'approved', 'approved']);

    const denied = pending();
    denied.deny('user-1', NOW);
    const expired = pending();
    expired.expire(NOW);
    expect([announced(denied), announced(expired)]).toEqual([
      ['pending', 'denied'],
      ['pending', 'expired'],
    ]);
  });

  it('announces nothing for a move it refuses', () => {
    const approval = pending();
    approval.approve('user-1', NOW);
    approval.clearEvents();
    expect(() => approval.deny('user-1', NOW)).toThrow();
    expect(approval.domainEvents).toEqual([]);
  });

  it('starts pending, undecided, with a summary cut to fit the card', () => {
    const approval = pending('x'.repeat(600));
    expect(approval).toMatchObject({ status: 'pending', decidedAt: null, decidedByUserId: null });
    expect(approval.summary).toHaveLength(500);
    expect(approval.summary.endsWith('…')).toBe(true);
  });

  it('is approved by a person, then keeps what the call answered', () => {
    const approval = pending();
    approval.approve('user-1', NOW);
    expect(approval).toMatchObject({
      status: 'approved',
      decidedByUserId: 'user-1',
      decidedAt: NOW,
    });
    approval.recordResult('Started session s-1', false);
    expect(approval).toMatchObject({ status: 'approved', result: 'Started session s-1' });
  });

  it('ends failed when the approved call errored', () => {
    const approval = pending();
    approval.approve('user-1', NOW);
    approval.recordResult('SESSIONS_010: Host offline.', true);
    expect(approval.status).toBe('failed');
  });

  it('is denied with the person’s note, trimmed, and an empty note is none', () => {
    const denied = pending();
    denied.deny('user-1', NOW, '  use staging  ');
    expect(denied).toMatchObject({ status: 'denied', note: 'use staging' });
    const bare = pending();
    bare.deny('user-1', NOW, '   ');
    expect(bare.note).toBeNull();
  });

  it('expires with nobody deciding', () => {
    const approval = pending();
    approval.expire(NOW);
    expect(approval).toMatchObject({ status: 'expired', decidedByUserId: null, decidedAt: NOW });
  });

  it('refuses every second decision, and a result for anything not approved', () => {
    for (const settle of [
      (a: BotApprovalEntity) => a.approve('user-1', NOW),
      (a: BotApprovalEntity) => a.deny('user-1', NOW),
      (a: BotApprovalEntity) => a.expire(NOW),
    ]) {
      const approval = pending();
      settle(approval);
      expect(() => approval.approve('user-2', NOW)).toThrow();
      expect(() => approval.deny('user-2', NOW)).toThrow();
      expect(() => approval.expire(NOW)).toThrow();
    }
    expect(() => pending().recordResult('x', false)).toThrow();
  });

  it('remembers the status it was loaded in until a write lands', () => {
    const approval = pending();
    approval.approve('user-1', NOW);
    expect(approval.statusAtLoad).toBe('pending');
    approval.markPersisted();
    expect(approval.statusAtLoad).toBe('approved');
  });
});

describe('approvalEvent', () => {
  it('says who approved what, then what the call answered', () => {
    const approval = pending();
    approval.approve('user-1', NOW);
    approval.recordResult('Started session s-1.', false);
    expect(approvalEvent(approval, 'Ana')).toBe(
      'Ana approved: Start Claude Code on build-02\nIt ran: Started session s-1.',
    );
  });

  it('says a failed call failed', () => {
    const approval = pending();
    approval.approve('user-1', NOW);
    approval.recordResult('Host offline.', true);
    expect(approvalEvent(approval, 'Ana')).toContain('It ran and failed: Host offline.');
  });

  it('says who denied it, with their note, and names nobody when the name is unknown', () => {
    const approval = pending();
    approval.deny('user-1', NOW, 'Use staging');
    expect(approvalEvent(approval, ' ')).toBe(
      'The person denied: Start Claude Code on build-02\nTheir note: Use staging',
    );
  });
});

describe('approvalEventOf', () => {
  const SESSION = '0b6c3f0e-5a7d-4c1e-9f2a-1d2e3f4a5b6c';

  it('carries the session the approved call said it started, whatever its words', () => {
    const approval = pending();
    approval.approve('user-1', NOW);
    approval.recordResult('Done: the agent is on it.', false, SESSION);
    expect(approvalEventOf(approval)).toMatchObject({ outcome: 'approved', sessionId: SESSION });
  });

  it('carries no session for a call that started none, a failed call or a denied one', () => {
    const quiet = pending();
    quiet.approve('user-1', NOW);
    quiet.recordResult(`Started session ${SESSION} on host h-1.`, false);
    expect(approvalEventOf(quiet)).toMatchObject({ outcome: 'approved', sessionId: null });

    const failed = pending();
    failed.approve('user-1', NOW);
    failed.recordResult('SESSIONS_010: Host offline.', true, SESSION);
    expect(approvalEventOf(failed)).toMatchObject({ outcome: 'failed', sessionId: null });

    const denied = pending();
    denied.deny('user-1', NOW, null);
    expect(approvalEventOf(denied)).toMatchObject({ outcome: 'denied', sessionId: null });
  });
});

describe('availableDecisions', () => {
  it('offers, in order, a yes, the yes for its subject and for the tool, a no that carries on and a no that stops', () => {
    const card = pending('Start it', { subject: { kind: 'project', key: 'p-1', label: 'XRP' } });
    expect(card.availableDecisions).toEqual([
      'approve',
      'approve_for_subject',
      'approve_always',
      'deny',
      'stop',
    ]);
  });

  it('offers no yes that stands for a tool decided call by call, nor for a subject the card does not name', () => {
    expect(pending('Merge it', { perCallOnly: true }).availableDecisions).toEqual([
      'approve',
      'deny',
      'stop',
    ]);
    expect(pending().availableDecisions).toEqual(['approve', 'approve_always', 'deny', 'stop']);
  });
});

describe('decisionOf', () => {
  it('reads the older approve with a reach as the decision it meant, and a named decision as itself', () => {
    expect(decisionOf('approve', 'once')).toBe('approve');
    expect(decisionOf('approve', 'tool')).toBe('approve_always');
    expect(decisionOf('approve', 'subject')).toBe('approve_for_subject');
    expect(decisionOf('stop', 'tool')).toBe('stop');
    expect(decisionOf('approve_always', 'once')).toBe('approve_always');
  });
});

describe('a no that stops the turn', () => {
  it('is a line outside any turn, saying who stopped what, with the note, naming its card', () => {
    const approval = pending();
    approval.deny('user-1', NOW, 'Not today');
    const line = stoppedLine(approval, 'Ana');
    expect(line).toMatchObject({
      turnId: null,
      role: 'event',
      content:
        'Ana denied and stopped your turn: Start Claude Code on build-02\nTheir note: Not today',
      event: { kind: 'approval', outcome: 'stopped', approvalId: approval.id },
    });
    expect(approval.status).toBe('denied');
  });
});

describe('approvalResolved', () => {
  it('tells every chat which card closed and how, with its line', () => {
    const approval = pending();
    const of = (decision: Parameters<typeof approvalResolved>[1]) =>
      approvalResolved(approval, decision).outcome;
    expect(approvalResolved(approval, 'approve')).toEqual({
      type: 'approval_resolved',
      approvalId: approval.id,
      outcome: 'approved',
      tool: 'start_session',
      summary: 'Start Claude Code on build-02',
    });
    expect([of('approve_always'), of('deny'), of('stop'), of('expired')]).toEqual([
      'approved',
      'denied',
      'stopped',
      'expired',
    ]);
  });
});
