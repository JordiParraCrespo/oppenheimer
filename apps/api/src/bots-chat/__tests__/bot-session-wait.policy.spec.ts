import { sessionWaitAnswer, sessionWaitOutcome } from '../domain/bot-session-wait.policy';

/**
 * When a bot's in-turn wait on a session is over (`25-bots.md` §4.2). What
 * breaks this: a wait that keeps going after the task asked for input or
 * ended, or one that stops on a task still running; an answer that reads as
 * done when the time simply ran out.
 */
const view = (state: string | null, resolved = false) => ({
  resolved,
  latestTurn: state === null ? null : { seq: 3, state },
});

describe('sessionWaitOutcome', () => {
  it('settles on the states a watch wakes for, and on a closed session', () => {
    expect(sessionWaitOutcome(view('requires_action'))).toEqual({
      settled: true,
      state: 'requires_action',
      turnSeq: 3,
    });
    expect(sessionWaitOutcome(view('completed'))).toMatchObject({ settled: true });
    expect(sessionWaitOutcome(view('failed'))).toMatchObject({ settled: true });
    expect(sessionWaitOutcome(view('in_progress', true))).toMatchObject({
      settled: true,
      state: 'resolved',
    });
  });

  it('keeps waiting while the task is queued or running, or there is none yet', () => {
    expect(sessionWaitOutcome(view('in_progress'))).toEqual({ settled: false });
    expect(sessionWaitOutcome(view('queued'))).toEqual({ settled: false });
    expect(sessionWaitOutcome(view(null))).toEqual({ settled: false });
  });
});

describe('sessionWaitAnswer', () => {
  it('says the time ran out rather than that the task ended', () => {
    expect(sessionWaitAnswer('s-1', { settled: false }, 60)).toMatch(/still working after 60s/);
    expect(sessionWaitAnswer('s-1', { settled: true, state: 'completed', turnSeq: 3 }, 12)).toMatch(
      /finished its task \(after 12s\)/,
    );
  });
});
