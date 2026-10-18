import { approvalCallDigest, BotApprovalEntity } from '../domain/bot-approval.entity';
import { approvalEvent } from '../domain/bot-approval.policy';

/**
 * A Needs input card is decided once (`25-bots.md` §5): pending moves to
 * approved, denied or expired and never again, and only before its time
 * runs out; a yes names the digest of the call it approves, which binds the
 * card's id, tool and input. Only an approved call records what it answered,
 * and an error ends it failed. The event the bot is then told says who
 * decided, what, and what came of it.
 */
const NOW = new Date('2026-10-15T10:00:00Z');
const HOUR = 60 * 60 * 1000;

function pending(summary = 'Start Claude Code on build-02', ttlMs?: number) {
  return BotApprovalEntity.request(
    {
      organizationId: 'org-1',
      botId: 'bot-1',
      turnId: 'turn-1',
      tool: 'start_session',
      input: { task: 'Fix it' },
      summary,
    },
    NOW,
    ttlMs,
  );
}

function approved(approval = pending()) {
  approval.approve('user-1', NOW, approval.callDigest);
  return approval;
}

describe('BotApprovalEntity', () => {
  it('starts pending, undecided, with a summary cut to fit the card', () => {
    const approval = pending('x'.repeat(600));
    expect(approval).toMatchObject({ status: 'pending', decidedAt: null, decidedByUserId: null });
    expect(approval.summary).toHaveLength(500);
    expect(approval.summary.endsWith('…')).toBe(true);
  });

  it('is approved by a person, then keeps what the call answered', () => {
    const approval = approved();
    expect(approval).toMatchObject({
      status: 'approved',
      decidedByUserId: 'user-1',
      decidedAt: NOW,
    });
    approval.recordResult('Started session s-1', false);
    expect(approval).toMatchObject({ status: 'approved', result: 'Started session s-1' });
  });

  it('ends failed when the approved call errored', () => {
    const approval = approved();
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
      (a: BotApprovalEntity) => a.approve('user-1', NOW, a.callDigest),
      (a: BotApprovalEntity) => a.deny('user-1', NOW),
      (a: BotApprovalEntity) => a.expire(NOW),
    ]) {
      const approval = pending();
      settle(approval);
      expect(() => approval.approve('user-2', NOW, approval.callDigest)).toThrow();
      expect(() => approval.deny('user-2', NOW)).toThrow();
      expect(() => approval.expire(NOW)).toThrow();
    }
    expect(() => pending().recordResult('x', false)).toThrow();
  });

  it('waits a day unless its tool says otherwise, and cannot be decided once that is up', () => {
    expect(pending().expiresAt).toEqual(new Date(NOW.getTime() + 24 * HOUR));
    const brief = pending('Delete bot "Scout"', HOUR);
    const late = new Date(NOW.getTime() + HOUR);
    expect(brief.isExpiredAt(new Date(late.getTime() - 1))).toBe(false);
    expect(brief.isExpiredAt(late)).toBe(true);
    expect(() => brief.approve('user-1', late, brief.callDigest)).toThrow();
    expect(() => brief.deny('user-1', late)).toThrow();
    expect(brief.status).toBe('pending');
    brief.expire(late);
    expect(brief).toMatchObject({ status: 'expired', decidedByUserId: null });
  });

  it('binds its id, tool and input in the digest a yes must name, whatever the key order', () => {
    const approval = pending();
    expect(approval.callDigest).toBe(
      approvalCallDigest(approval.id, 'start_session', { task: 'Fix it' }),
    );
    expect(approvalCallDigest('a', 't', { x: 1, y: { b: 2, a: 1 } })).toBe(
      approvalCallDigest('a', 't', { y: { a: 1, b: 2 }, x: 1 }),
    );
    const other = pending();
    expect(other.callDigest).not.toBe(approval.callDigest);
    expect(() => approval.approve('user-1', NOW, other.callDigest)).toThrow();
    expect(() => approval.approve('user-1', NOW, '')).toThrow();
    expect(approval.status).toBe('pending');
  });

  it('knows when its stored call is no longer the one its digest names', () => {
    const approval = pending();
    expect(approval.callIntact).toBe(true);
    approval.input.task = 'rm -rf /';
    expect(approval.callIntact).toBe(false);
  });

  it('remembers the status it was loaded in until a write lands', () => {
    const approval = approved();
    expect(approval.statusAtLoad).toBe('pending');
    approval.markPersisted();
    expect(approval.statusAtLoad).toBe('approved');
  });
});

describe('approvalEvent', () => {
  it('says who approved what, then what the call answered', () => {
    const approval = approved();
    approval.recordResult('Started session s-1.', false);
    expect(approvalEvent(approval, 'Ana')).toBe(
      'Ana approved: Start Claude Code on build-02\nIt ran: Started session s-1.',
    );
  });

  it('says a failed call failed', () => {
    const approval = approved();
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
