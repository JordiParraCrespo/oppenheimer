import {
  BOT_PROMPT_HOSTS_MAX,
  composeTurnContext,
  type TurnContextInput,
  withTurnContext,
} from '../domain/bot-turn-context.policy';

/**
 * The moment a turn runs in, as the block that opens its message: the
 * sender's time, the bot's home host, the owner's hosts. The battle tests
 * found a bot answering in UTC and promising work on hosts that were
 * offline. It used to be the system prompt's last section; it moved here so
 * the prompt stays the same from turn to turn (`bot-prompt.policy.spec.ts`).
 */
describe('composeTurnContext', () => {
  const base: TurnContextInput = {
    now: new Date('2026-10-15T09:00:00Z'),
    timeZone: null,
    homeHost: null,
    hosts: [],
  };

  it('is one block, wrapped in the tag the system prompt names', () => {
    const block = composeTurnContext(base);
    expect(block.startsWith('<turn_context>\n')).toBe(true);
    expect(block.endsWith('\n</turn_context>')).toBe(true);
  });

  it('tells the time in the sender’s zone, and in UTC when none, or no real one, was sent', () => {
    expect(composeTurnContext({ ...base, timeZone: 'Europe/Madrid' })).toContain(
      'It is Thursday, 15 October 2026, 11:00 (Europe/Madrid, GMT+02:00)',
    );
    expect(composeTurnContext(base)).toContain(
      'It is Thursday, 15 October 2026, 09:00 (UTC, GMT+00:00)',
    );
    expect(composeTurnContext({ ...base, timeZone: 'Mars/Olympus' })).toContain(
      'It is Thursday, 15 October 2026, 09:00 (UTC, GMT+00:00)',
    );
  });

  it('names its home host and the owner’s hosts with whether each is online', () => {
    const home = { name: 'build-01', online: true, runningSessions: 1 };
    const block = composeTurnContext({
      ...base,
      homeHost: home,
      hosts: [home, { name: 'old-laptop', online: false, runningSessions: 0 }],
    });
    expect(block).toContain('Your home host is build-01 (online)');
    expect(block).toContain(
      "The person's hosts: build-01 (online, 1 session running); old-laptop (offline, 0 sessions running).",
    );
  });

  it('says when there is no home host, no host at all, or the hosts could not be read', () => {
    expect(composeTurnContext(base)).toContain('You have no home host');
    expect(composeTurnContext(base)).toContain('The person has no hosts connected yet');
    expect(composeTurnContext({ ...base, hosts: null })).toContain(
      "The person's hosts could not be read just now",
    );
  });

  it('lists at most ten hosts and counts the rest', () => {
    const hosts = Array.from({ length: BOT_PROMPT_HOSTS_MAX + 2 }, (_, index) => ({
      name: `host-${index}`,
      online: true,
      runningSessions: 0,
    }));
    const block = composeTurnContext({ ...base, hosts });
    expect(block).toContain(`host-${BOT_PROMPT_HOSTS_MAX - 1} (online`);
    expect(block).not.toContain(`host-${BOT_PROMPT_HOSTS_MAX} (online`);
    expect(block).toContain('; and 2 more.');
  });
});

describe('withTurnContext', () => {
  it('opens the turn’s message with the block, then what the turn is asked', () => {
    expect(withTurnContext('<turn_context>\nIt is now.\n</turn_context>', 'Ship it')).toBe(
      '<turn_context>\nIt is now.\n</turn_context>\n\nShip it',
    );
  });
});
