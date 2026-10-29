import { describe, expect, it } from 'vitest';
import { SessionStateChangedDomainEvent } from '../domain/events/session-state-changed.domain-event';
import { SessionTerminalMatchedDomainEvent } from '../domain/events/session-terminal-matched.domain-event';
import { SESSION_EVENT_KINDS } from '../domain/session-state.policy';
import { SessionTerminalWatchEntity } from '../domain/session-terminal-watch.entity';
import { WorkSessionEntity } from '../domain/work-session.entity';

/**
 * Terminal watches, the session's half (`27-bot-subscriptions.md` §2). What
 * breaks this: a pattern the runner's RE2 cannot take accepted here, so the
 * bot is told it watches and nothing ever matches; a `terminal.matched` log
 * entry that moves the session's state, or that raises no event, so nobody
 * is woken; a malformed one raising an event with no watch to wake for.
 */
/** What the entity says of a pattern: null when it takes it, else why not. */
function refusal(pattern: string): string | null {
  try {
    SessionTerminalWatchEntity.watch({ organizationId: 'o', sessionId: 's', pattern });
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

describe('a watched pattern', () => {
  it('takes a plain regular expression, and Go’s leading inline flags', () => {
    expect(refusal('Tests: \\d+ passed|FAIL')).toBeNull();
    expect(refusal('(?i)error: \\w+')).toBeNull();
    expect(refusal('\\bpanic\\b|\\Aready\\z')).toBeNull();
  });

  it('refuses what RE2 lacks, an invalid expression, and an empty or long one', () => {
    expect(refusal('error(?!: none)')).toMatch(/Lookahead/);
    expect(refusal('(?<=x)y')).toMatch(/Lookahead/);
    expect(refusal('(a)\\1')).toMatch(/Backreferences/);
    expect(refusal('[unclosed')).toMatch(/not a valid/);
    expect(refusal('  ')).toMatch(/empty/);
    expect(refusal('x'.repeat(201))).toMatch(/longer than 200/);
  });

  // What breaks this: a pattern JavaScript takes and Go refuses, stored and
  // sent, so the bot is told it watches and its host never matches anything.
  it('refuses what JavaScript takes and Go does not: unknown escapes, repeats past 1000', () => {
    expect(refusal('a{1001}')).toMatch(/repeat count above 1000/);
    expect(refusal('a{2,1001}')).toMatch(/repeat count above 1000/);
    expect(refusal('a{1000}')).toBeNull();
    expect(refusal('\\u0041')).toMatch(/\\u is not an escape/);
    expect(refusal('end\\Z')).toMatch(/\\Z is not an escape/);
    expect(refusal('trailing\\')).toMatch(/lone backslash/);
  });
});

describe('a terminal.matched log entry', () => {
  const open = () => {
    const session = WorkSessionEntity.request({
      organizationId: 'org',
      projectId: 'project',
      createdByUserId: 'user',
      hostId: 'host',
      slug: 'bold-otter-3f9a7k',
      agent: 'claude-code',
    });
    session.recordEvent({ seq: 1, kind: 'session.started', payload: {}, occurredAt: new Date() });
    session.clearEvents();
    return session;
  };
  const matched = (payload: unknown) => ({
    seq: 2,
    kind: SESSION_EVENT_KINDS.TERMINAL_MATCHED,
    payload,
    occurredAt: new Date(),
  });

  it('raises the watch and its count, and moves no state', () => {
    const session = open();
    const before = session.state;
    session.recordEvent(matched({ watchId: 'w-1', count: 3 }));
    expect(session.state).toBe(before);
    const raised = session.domainEvents.filter(
      (event) => event instanceof SessionTerminalMatchedDomainEvent,
    );
    expect(raised).toEqual([
      expect.objectContaining({
        aggregateId: session.id,
        organizationId: 'org',
        watchId: 'w-1',
        count: 3,
      }),
    ]);
    expect(
      session.domainEvents.some((event) => event instanceof SessionStateChangedDomainEvent),
    ).toBe(false);
  });

  it('raises nothing for an entry with no watch or no count', () => {
    const session = open();
    session.recordEvent(matched({ watchId: 'w-1' }));
    session.recordEvent(matched({ count: 2 }));
    session.recordEvent(matched({ watchId: 'w-1', count: 0 }));
    expect(
      session.domainEvents.some((event) => event instanceof SessionTerminalMatchedDomainEvent),
    ).toBe(false);
  });
});
