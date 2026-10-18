import { BotApprovalEntity } from '../domain/bot-approval.entity';
import { approvalEvent, approvalEventOf } from '../domain/bot-approval.policy';

/**
 * A Needs input card is decided once (`25-bots.md` §5): pending moves to
 * approved, denied or expired and never again; only an approved call records
 * what it answered, and an error ends it failed. The event the bot is then
 * told says who decided, what, and what came of it.
 */
const NOW = new Date('2026-10-15T10:00:00Z');

function pending(summary = 'Start Claude Code on build-02') {
  return BotApprovalEntity.request({
    organizationId: 'org-1',
    botId: 'bot-1',
    turnId: 'turn-1',
    tool: 'start_session',
    input: { task: 'Fix it' },
    summary,
  });
}

describe('BotApprovalEntity', () => {
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

  it('carries the session an approved start_session started, for the chat to link to', () => {
    const approval = pending();
    approval.approve('user-1', NOW);
    approval.recordResult(
      `Started session ${SESSION} on host h-1. The agent works on its own.`,
      false,
    );
    expect(approvalEventOf(approval)).toMatchObject({ outcome: 'approved', sessionId: SESSION });
  });

  it('carries no session for a failed or denied call', () => {
    const failed = pending();
    failed.approve('user-1', NOW);
    failed.recordResult(`Started session ${SESSION} on host h-1.`, true);
    expect(approvalEventOf(failed)).toMatchObject({ outcome: 'failed', sessionId: null });

    const denied = pending();
    denied.deny('user-1', NOW, null);
    expect(approvalEventOf(denied)).toMatchObject({ outcome: 'denied', sessionId: null });
  });
});
