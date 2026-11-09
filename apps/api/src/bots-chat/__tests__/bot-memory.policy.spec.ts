/**
 * Which facts a turn keeps in mind (`25-bots.md` §4.1). What breaks this: a
 * `log` fact left out of every prompt, so a bot that saves as it goes never
 * sees what it saved; the log or the profile growing the prompt with every
 * fact kept, where each stops at its budget of characters; the oldest facts
 * kept in mind when there are more than fit, where the newest should win; a
 * bot not told there is more to `recall`. How the log is dated and where it
 * is said is `bot-turn-context.policy.spec.ts`.
 */
import {
  describeKept,
  memoryInMind,
  memoryScopeOf,
  type RememberedFact,
} from '../domain/bot-memory.policy';

const fact = (
  content: string,
  tier: RememberedFact['tier'] = 'profile',
  scope: RememberedFact['scope'] = 'bot',
  createdAt = new Date('2026-11-03T23:30:00Z'),
): RememberedFact => ({ content, tier, scope, createdAt });

const budget = { profileChars: 1_000, logChars: 1_000 };
const contents = (entries: { content: string }[]) => entries.map((entry) => entry.content);

describe('memoryInMind', () => {
  it('keeps profile facts in mind, the person’s apart, and the log, oldest first', () => {
    const newestFirst = [
      fact('Uses pnpm'),
      fact('Ana is the release manager', 'profile', 'person'),
      fact('Ticket 412 was the login race', 'log', 'bot', new Date('2026-11-05T09:00:00Z')),
      fact('Deploys on Thursdays'),
      fact('Staging moved to devbox', 'log', 'bot', new Date('2026-11-02T09:00:00Z')),
    ];
    const inMind = memoryInMind(newestFirst, budget);
    expect(inMind).toMatchObject({
      own: ['Deploys on Thursdays', 'Uses pnpm'],
      person: ['Ana is the release manager'],
      toRecall: 0,
    });
    expect(inMind.log).toEqual([
      {
        content: 'Staging moved to devbox',
        createdAt: new Date('2026-11-02T09:00:00Z'),
        scope: 'bot',
      },
      {
        content: 'Ticket 412 was the login race',
        createdAt: new Date('2026-11-05T09:00:00Z'),
        scope: 'bot',
      },
    ]);
  });

  it('keeps the newest of each tier within its budget of characters, and leaves the rest to recall', () => {
    const newestFirst = [
      fact('cccc'),
      fact('zz', 'log'),
      fact('bbbb'),
      fact('yy', 'log'),
      fact('aaaa'),
      fact('xx', 'log'),
    ];
    const inMind = memoryInMind(newestFirst, { profileChars: 9, logChars: 4 });
    expect(inMind).toMatchObject({ own: ['bbbb', 'cccc'], person: [], toRecall: 2 });
    expect(contents(inMind.log)).toEqual(['yy', 'zz']);
  });
});

describe('describeKept', () => {
  it('says which memory keeps a fact, and when another of the person’s bots saved it', () => {
    expect(describeKept({ tier: 'log', scope: 'bot', botId: 'b1' }, 'b1')).toBe(
      'your memory, in the log',
    );
    expect(describeKept({ tier: 'profile', scope: 'person', botId: 'b1' }, 'b1')).toBe(
      'general memory, in mind',
    );
    expect(describeKept({ tier: 'profile', scope: 'person', botId: 'b2' }, 'b1')).toBe(
      'general memory, in mind, saved by another of their bots',
    );
  });

  it('keeps a fact in the bot’s own memory unless it was told to use the general one', () => {
    expect([memoryScopeOf(undefined), memoryScopeOf('yours'), memoryScopeOf('general')]).toEqual([
      'bot',
      'bot',
      'person',
    ]);
  });
});
