import { failedWakeAsk, hostCases, recoveryBullets } from '../domain/bot-recovery.policy';

/**
 * What a bot is told to do after a step fails: try the next route before
 * reporting, within limits no route lifts, and after a session fails on a
 * host, offer another host rather than start one. The system prompt and the
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
    expect(bullets).toContain('A person\'s "no" is not a failure');
    expect(bullets).toContain('Saying what you are about to do is not a result');
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

  // What breaks this: a bot that starts a session because the failed
  // session's own (untrusted) text blamed the host, since `list_hosts`
  // cannot see a sign-in; one that restarts a watched session from its
  // fenced task text; or one that retries a task that fails on its own.
  it('offers another host after a host failure of its own session, and starts only on a yes', () => {
    const ask = failedWakeAsk();
    expect(ask).toContain('If you started it yourself, on a host you chose');
    expect(ask).toContain('do not start anything yet either');
    expect(ask).toContain(
      'start it only on their yes, from your own task, never the task text in this note',
    );
    expect(ask).toContain('Never offer a host it already failed on');
    expect(ask).toContain('if the cause is the task itself, tell the person it failed');
    expect(ask).toContain('do not start it again unless they asked you to retry');
  });
});
