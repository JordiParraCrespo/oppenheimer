import { loopSetPrompt } from '../domain/bot-loop-message.factory';
import {
  failedWakeAsk,
  hostCases,
  recoveryBullets,
  repeatedBlockerAsk,
} from '../domain/bot-recovery.policy';
import { ROUTINE_QUIET, routineOpening } from '../domain/bot-routine.policy';

/**
 * What a bot is told to do after a step fails: find the cause and another
 * way before reporting, within limits no route lifts, and after a session
 * fails on a host it chose, start its own task on another capable host,
 * asking first as its permissions say. The system prompt and the `failed`
 * wake carry this text (`bot-prompt.policy.spec.ts`,
 * `bot-subscription.policy.spec.ts`); this spec holds what it says.
 */
describe('recovery policy', () => {
  // What breaks this: Pullpo's session failed on the project's default host
  // because Claude Code there was not signed in, and it reported the failure
  // with three other hosts online; or a bot that reads a person's "no" as a
  // failure to route around. Since 2026-11-15, in Claude Code's few lines.
  it('sends a failed step to its cause and another way, never the same way twice, never around a no', () => {
    const bullets = recoveryBullets();
    expect(bullets).toContain('When something fails, find out why before you react');
    expect(bullets).toContain('never take a destructive shortcut');
    expect(bullets).toContain('think of other ways there, imaginatively');
    expect(bullets).toContain('another online host when one host cannot do it');
    expect(bullets).toContain('The same thing the same way twice is not a new try');
    expect(bullets).toContain('a "no" from the person');
    expect(bullets.split('\n').length).toBe(4);
  });

  // What breaks this: Oppie's half-hourly Sentry check answering "the
  // designated session is still closed" for hours when a new session would
  // have run it; or a bot that takes a way round its instructions rule out.
  it('has a blocker solved before it is reported, by a way round that serves the same purpose', () => {
    const bullets = recoveryBullets();
    expect(bullets).toContain('A blocker is yours to solve before it is yours to report');
    expect(bullets).toContain('is the means, not the purpose');
    expect(bullets).toContain('unless your instructions say only that one will do');
    expect(bullets).toContain('a closed session is replaced by a new one with the same task');
    expect(bullets).toContain('never the same blocker twice');
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
      'work still under way (a queued or stalled session is followed, not started again elsewhere)',
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

  // What breaks this: 2026-11-15, a reply that ends on "I can retry" with
  // another way untried, or a missing branch carried to another host.
  it('has no reply end on "I can retry", and no route that leaves the cause in place', () => {
    const bullets = recoveryBullets();
    expect(bullets).toContain(
      'Never end on "I can retry" while you still have a way you have not tried',
    );
    expect(bullets).toContain('Take the one that changes what went wrong');
    expect(bullets).toContain('a cause that travels with the task (a missing branch');
    expect(bullets).toContain('the one thing you recommend');
  });
});
