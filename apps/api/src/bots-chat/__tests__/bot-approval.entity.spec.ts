import { BotApprovalEntity } from '../domain/bot-approval.entity';
import { approvalEvent, approvalEventOf } from '../domain/bot-approval.policy';
import { BotApprovalChangedDomainEvent } from '../domain/events/bot-approval-changed.domain-event';

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

/**
 * A card of questions (`ask_user`, `25-bots.md` §3.2) is answered or
 * dismissed, never approved: each answer must fit its question, and the bot
 * is told what was chosen, fenced as data, while the chat gets each pair.
 */
describe('a card of questions', () => {
  const questions = [
    {
      header: 'Repo',
      question: 'Which repository?',
      multiSelect: false,
      options: [
        { label: 'acme/web', description: null },
        { label: 'acme/api', description: null },
      ],
    },
    {
      header: null,
      question: 'What goes in the notes?',
      multiSelect: true,
      options: [
        { label: 'Fixes', description: null },
        { label: 'Features', description: null },
        { label: 'Thanks', description: null },
      ],
    },
  ];
  const asked = () =>
    BotApprovalEntity.request({
      organizationId: 'org-1',
      botId: 'bot-1',
      turnId: 'turn-1',
      tool: 'ask_user',
      input: { questions },
      summary: 'Which repository? (+1 more)',
      perCallOnly: true,
    });

  it('offers no reach and refuses a yes', () => {
    const card = asked();
    expect(card.reaches).toEqual([]);
    expect(() => card.approve('user-1', NOW)).toThrow('answered');
    expect(card.status).toBe('pending');
  });

  it('is answered with picks and own words, deduplicated and trimmed', () => {
    const card = asked();
    card.answer('user-1', NOW, [
      { picks: [1], other: null },
      { picks: [2, 0, 2], other: '  and the upgrade steps ' },
    ]);
    expect(card.status).toBe('answered');
    expect(card.answers).toEqual([
      { picks: [1], other: null },
      { picks: [0, 2], other: 'and the upgrade steps' },
    ]);
    expect(card.decidedByUserId).toBe('user-1');
  });

  it.each([
    ['one answer for two questions', [{ picks: [0], other: null }]],
    [
      'an option it does not have',
      [
        { picks: [5], other: null },
        { picks: [0], other: null },
      ],
    ],
    [
      'two picks where one is taken',
      [
        { picks: [0, 1], other: null },
        { picks: [0], other: null },
      ],
    ],
    [
      'a question left unanswered',
      [
        { picks: [0], other: null },
        { picks: [], other: '  ' },
      ],
    ],
  ])('refuses %s and stays pending', (_, answers) => {
    const card = asked();
    expect(card.answersProblem(answers)).not.toBeNull();
    expect(() => card.answer('user-1', NOW, answers)).toThrow();
    expect(card.status).toBe('pending');
  });

  it('takes no answers on a card that asks to run a call', () => {
    expect(pending().answersProblem([{ picks: [0], other: null }])).toBe(
      'Only a card of questions is answered',
    );
  });

  it('tells the bot each answer between markers, and the chat each question with its answer', () => {
    const card = asked();
    card.answer('user-1', NOW, [
      { picks: [0], other: null },
      { picks: [0], other: 'upgrade steps' },
    ]);
    const words = approvalEvent(card, 'Ana');
    expect(words).toContain('Ana answered your questions.');
    expect(words).toContain(
      '<answers>\n- Which repository?\n  Answer: acme/web\n- What goes in the notes?\n  Answer: Fixes; “upgrade steps”\n</answers>',
    );
    expect(approvalEventOf(card)).toMatchObject({
      outcome: 'answered',
      answers: [
        { question: 'Which repository?', answer: 'acme/web' },
        { question: 'What goes in the notes?', answer: 'Fixes; “upgrade steps”' },
      ],
    });
  });

  it('tells the bot it was dismissed, with the note, and not to ask again', () => {
    const card = asked();
    card.deny('user-1', NOW, 'Not now');
    expect(approvalEvent(card, 'Ana')).toBe(
      'Ana dismissed your questions: Which repository? (+1 more)\nTheir note: Not now\nDo not ask them again unless they bring it up.',
    );
    expect(approvalEventOf(card)).not.toHaveProperty('answers');
  });
});
