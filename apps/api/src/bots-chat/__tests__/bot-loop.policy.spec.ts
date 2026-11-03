import type { EndedTurn } from '../domain/bot-goal.policy';
import { BotLoopEntity } from '../domain/bot-loop.entity';
import {
  loopFromMessage,
  loopRunDecision,
  loopRunEnd,
  loopRunTurn,
  loopSourceKey,
  nextRunAfter,
  nextRunWhenBusy,
  selfPacedRunAt,
} from '../domain/bot-loop.policy';

/**
 * A loop's decisions (`25-bots.md` §4.1, `/loop`), as pure functions of the
 * loop, the time and the turn that ended. What breaks this: a run job that
 * was moved or already ran queuing a second run; a fixed loop drifting off
 * its slots, or running past its expiry; a busy bot handed a pile of runs; a
 * passing failure ending a loop meant to run for days; a self-paced loop
 * going on with nobody saying when.
 */

const SET_AT = new Date('2026-11-03T09:00:00Z');
const minutes = (count: number) => new Date(SET_AT.getTime() + count * 60_000);

function loop(intervalMinutes: number | null): BotLoopEntity {
  return BotLoopEntity.set(
    {
      organizationId: 'org-1',
      botId: 'bot-1',
      originTurnId: 'turn-0',
      prompt: 'check the deploy',
      intervalMinutes,
      credentialScopes: null,
      timeZone: null,
    },
    SET_AT,
  );
}

function ended(overrides: Partial<EndedTurn>): EndedTurn {
  return { id: 'turn-9', sourceKey: null, status: 'completed', failure: null, ...overrides };
}

describe('loopFromMessage', () => {
  const turn = {
    organizationId: 'org-1',
    botId: 'bot-1',
    id: 'turn-0',
    credentialScopes: null,
    timeZone: 'Europe/Madrid',
  };

  it('sets a fixed loop due one interval on, expiring 3 days after it was set', () => {
    const set = loopFromMessage('/loop 5m check the deploy', turn, SET_AT);
    expect(set).toMatchObject({
      prompt: 'check the deploy',
      intervalMinutes: 5,
      originTurnId: 'turn-0',
      nextRunAt: minutes(5),
      expiresAt: minutes(3 * 24 * 60),
    });
  });

  it('sets a self-paced loop with no run due until its first run says', () => {
    expect(loopFromMessage('/loop watch PR 42', turn, SET_AT)).toMatchObject({
      intervalMinutes: null,
      nextRunAt: null,
    });
  });

  it('refuses an interval out of range, and sets nothing for any other message', () => {
    expect(() => loopFromMessage('/loop 2d x', turn, SET_AT)).toThrow();
    expect(loopFromMessage('/loop stop', turn, SET_AT)).toBeNull();
    expect(loopFromMessage('/goal ship it', turn, SET_AT)).toBeNull();
  });
});

describe('loopRunDecision', () => {
  it('runs the job that is the next run at the time it was staged for', () => {
    expect(loopRunDecision(loop(5), { run: 1, at: minutes(5) }, minutes(5))).toBe('run');
  });

  it('does nothing for a job whose run was queued or moved since', () => {
    expect(loopRunDecision(loop(5), { run: 2, at: minutes(5) }, minutes(5))).toBe('stale');
    expect(loopRunDecision(loop(5), { run: 1, at: minutes(4) }, minutes(5))).toBe('stale');
  });

  it('ends a loop whose run comes due at or past its expiry', () => {
    const expiring = loop(5);
    expiring.moveNext(expiring.expiresAt);
    expect(loopRunDecision(expiring, { run: 1, at: expiring.expiresAt }, expiring.expiresAt)).toBe(
      'expire',
    );
  });
});

describe('when the next run is due', () => {
  it('keeps a fixed loop on its slots, skipping the ones a late job missed', () => {
    expect(nextRunAfter(loop(5), minutes(5))).toEqual(minutes(10));
    expect(nextRunAfter(loop(5), minutes(17))).toEqual(minutes(20));
  });

  it('never runs a fixed loop past its expiry: the run due then ends it', () => {
    const daily = loop(1_440);
    daily.moveNext(minutes(3 * 1_440 - 60));
    expect(nextRunAfter(daily, minutes(3 * 1_440 - 60))).toEqual(daily.expiresAt);
  });

  it('leaves a self-paced loop to its run, and tries a busy one again a minute on', () => {
    expect(nextRunAfter(loop(null), minutes(1))).toBeNull();
    expect(nextRunWhenBusy(loop(null), minutes(1))).toEqual(minutes(2));
    expect(nextRunWhenBusy(loop(5), minutes(5))).toEqual(minutes(10));
  });

  it('bounds what the bot asks for to 1 to 60 minutes', () => {
    expect(selfPacedRunAt(loop(null), 0, SET_AT)).toEqual(minutes(1));
    expect(selfPacedRunAt(loop(null), 500, SET_AT)).toEqual(minutes(60));
  });
});

describe('loopRunEnd', () => {
  const run = (overrides: Partial<EndedTurn>) =>
    ended({ sourceKey: loopSourceKey(loop(5).id, 1), ...overrides });

  it('changes nothing for a turn that is not one of the loop’s', () => {
    expect(loopRunEnd(loop(5), ended({ status: 'failed', failure: 'credential' }))).toEqual({
      kind: 'keep',
    });
  });

  it('stops the loop on a run the person stopped, or one that would fail again', () => {
    const fixed = loop(5);
    const key = loopSourceKey(fixed.id, 1);
    expect(loopRunEnd(fixed, run({ sourceKey: key, status: 'cancelled' }))).toMatchObject({
      kind: 'end',
      activity: 'stopped',
    });
    expect(
      loopRunEnd(fixed, run({ sourceKey: key, status: 'failed', failure: 'usage_limit' })),
    ).toMatchObject({ kind: 'end', activity: 'stopped' });
  });

  it('keeps it through the time limit and passing failures: the next run starts afresh', () => {
    const fixed = loop(5);
    for (const failure of ['time_limit', 'rate_limit', 'unavailable'] as const) {
      expect(loopRunEnd(fixed, ended({ id: 'turn-0', status: 'failed', failure }))).toEqual({
        kind: 'keep',
      });
    }
  });

  it('ends a self-paced loop whose run did not say when, unless that run failed in passing', () => {
    const selfPaced = loop(null);
    expect(loopRunEnd(selfPaced, ended({ id: 'turn-0' }))).toMatchObject({
      kind: 'end',
      activity: 'ended',
    });
    expect(
      loopRunEnd(selfPaced, ended({ id: 'turn-0', status: 'failed', failure: 'rate_limit' })),
    ).toEqual({ kind: 'retry' });
    selfPaced.moveNext(minutes(10));
    expect(loopRunEnd(selfPaced, ended({ id: 'turn-0' }))).toEqual({ kind: 'keep' });
  });
});

describe('loopRunTurn', () => {
  it('queues a run in the background lane, keyed by the loop and its count, opened by its line', () => {
    const fixed = loop(5);
    const { turn, opening } = loopRunTurn(
      {
        organizationId: 'org-1',
        botId: 'bot-1',
        requestedByUserId: 'user-1',
        provider: 'glm',
        model: 'glm-5.3',
        effort: null,
      },
      fixed,
      1,
    );
    expect(turn).toMatchObject({
      origin: 'loop',
      lane: 'background',
      sourceKey: loopSourceKey(fixed.id, 1),
    });
    // The setting turn was the first run, so the first one queued is the second.
    expect(opening.event).toMatchObject({ kind: 'loop', activity: 'ran', run: 2 });
    expect(opening.content).toContain('Run 2 of your loop');
  });
});
