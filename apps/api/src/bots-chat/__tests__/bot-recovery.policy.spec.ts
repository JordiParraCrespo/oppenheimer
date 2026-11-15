import { loopSetPrompt } from '../domain/bot-loop-message.factory';
import {
  failedWakeAsk,
  hostCases,
  recoveryBullets,
  repeatedBlockerAsk,
} from '../domain/bot-recovery.policy';
import { ROUTINE_QUIET, routineOpening } from '../domain/bot-routine.policy';

/**
 * What a bot is told to do after a step fails: try the next route before
 * reporting, within limits no route lifts, and after a session fails on a
 * host, start its own task on another capable host, asking first as its
 * permissions say. The system prompt and the
 * `failed` wake carry this text (`bot-prompt.policy.spec.ts`,
 * `bot-subscription.policy.spec.ts`); this spec holds what it says.
 */
describe('recovery policy', () => {
  // What breaks this: Pullpo's session failed on the project's default host
  // because Claude Code there was not signed in, and it reported the failure
  // with three other hosts online; or a bot that reads a person's "no" as a
  // failure to route around.
  it('sends a failed step to the next route, never the same way twice, never around a no', () => {
    const bullets = recoveryBullets();
    expect(bullets).toContain('A failed step is not the end of the request');
    expect(bullets).toContain('another online host when one host cannot do it');
    expect(bullets).toContain('Do not try the same thing the same way twice.');
    expect(bullets).toContain('Take a route only if it changes what made the step fail');
    expect(bullets).toContain('A person\'s "no" is not a failure');
    expect(bullets).toContain('Saying what you are about to do is not a result');
  });

  // What breaks this: Oppie's half-hourly Sentry check answering "the
  // designated session is still closed" for hours when a new session would
  // have run it; or a bot that takes a way round its instructions rule out.
  it('has a blocker solved before it is reported, by a way round that serves the same purpose', () => {
    const bullets = recoveryBullets();
    expect(bullets).toContain('A blocker is yours to solve before it is yours to report');
    expect(bullets).toContain('is the means, not the purpose');
    expect(bullets).toContain(
      'stays within your permissions and instructions, and nobody said no to it',
    );
    expect(bullets).toContain('a way round is never a way past it');
    expect(bullets).toContain('Never report the same blocker twice');
    expect(bullets).toContain(
      'a new one with the same task when the session, terminal or branch you were to use is closed or gone',
    );
  });

  // What breaks this: a run nobody asked for that reads its own earlier
  // "still closed" replies and writes one more; or one that, with no way
  // round, tells the person again every half hour.
  it('tells a repeated run to solve the blocker its last run ended on, and to say it once', () => {
    const ask = repeatedBlockerAsk(ROUTINE_QUIET);
    expect(ask).toContain('do not answer with it again');
    expect(ask).toContain('it is yours to solve in this run');
    expect(ask).toContain(
      'a new one with the same task when the session, terminal or branch you were to use is closed or gone',
    );
    expect(ask).toContain('tell them once what you need from them');
    expect(ask).toContain('do not tell them again while nothing has changed');
    expect(ask).toContain('call nothing_to_report and write nothing');
  });

  // What breaks this: the rule left only in the system prompt, where it lost
  // to the chat's history: a routine's or a loop's run has to read it in the
  // note that opens the turn.
  it('reaches a routine and a loop in the note that opens each run', () => {
    const opening = routineOpening({
      automationId: 'automation-1',
      runId: 'run-1',
      name: 'Sentry check',
      instructions: 'Run the Sentry check.',
    });
    expect(opening).toContain(repeatedBlockerAsk(ROUTINE_QUIET));
    expect(loopSetPrompt(30, 'check Sentry')).toContain(
      repeatedBlockerAsk('call end_loop and say why in one line'),
    );
  });

  // What breaks this: a queued or stalled session on one host and a second
  // one started on another, two agents on one task.
  it('follows work still under way rather than starting it again elsewhere', () => {
    expect(recoveryBullets()).toContain(
      'Work still under way (a queued or stalled session) has not failed',
    );
  });

  // What breaks this: stopping at a default host that cannot run the agent
  // while another can, or overriding a host the person named.
  it('falls back from a host it chose, never from one the person named', () => {
    const [named, chosen, none] = hostCases().split('\n');
    expect(named).toContain(
      'The host the person named cannot run the task now: do not pick another',
    );
    expect(chosen).toContain('A host you chose yourself (the default or your home host)');
    expect(chosen).toContain('start it there instead of stopping');
    expect(none).toContain('say the session is queued');
  });

  // What breaks this: 2026-11-15, a bot that stopped at "Claude Code on New
  // host isn't signed in… then I can retry" with other hosts online (before,
  // it was told only to offer another host); one that restarts a watched
  // session from its fenced task text; one that moves off a host the person
  // named; or one that retries a task that fails on its own.
  it('starts its own task on another capable host after a host failure, never off a named host', () => {
    const ask = failedWakeAsk();
    expect(ask).toContain('If you started it yourself, on a host you chose');
    expect(ask).toContain('do not stop at the failure');
    expect(ask).toContain(
      'start the task you wrote earlier in this chat there, from your own task, never the task text in this note, asking first as your permissions say',
    );
    expect(ask).toContain('Never start it on a host it already failed on');
    expect(ask).toContain('If the person named the host, do not move it');
    expect(ask).toContain('name the hosts that could run it now, and ask which to use');
    expect(ask).toContain('If the cause is the task itself, tell the person it failed');
    expect(ask).toContain('do not start it again unless they asked you to retry');
  });

  // What breaks this: 2026-11-15, the route that failed taken for the end of
  // the request: a reply that ends on "I can retry" or on what the person
  // could do while another way was untried.
  it('has a failed step looked at from what it was for, and no reply end on "I can retry"', () => {
    const bullets = recoveryBullets();
    expect(bullets).toContain('Step back from the route that failed to what it was for');
    expect(bullets).toContain('Check which of them can work now');
    expect(bullets).toContain('Never end a reply on "I can retry"');
    expect(bullets).toContain('give the options left with the one you recommend');
  });
});
