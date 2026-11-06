/**
 * Which facts a turn keeps in mind (`25-bots.md` §4.1). What breaks this: a
 * `log` fact left out of every prompt, so a bot that saves as it goes never
 * sees what it saved; the log or the profile growing the prompt with every
 * fact kept, where each stops at its budget of characters; the oldest facts
 * kept in mind when there are more than fit, where the newest should win; a
 * log entry without its day; a bot not told there is more to `recall`.
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

const budget = { profileChars: 1_000, logChars: 1_000, timeZone: 'UTC' };

describe('memoryInMind', () => {
  it('keeps profile facts in mind, the person’s apart, and the log under each day, oldest first', () => {
    const newestFirst = [
      fact('Uses pnpm'),
      fact('Ana is the release manager', 'profile', 'person'),
      fact('Ticket 412 was the login race', 'log', 'bot', new Date('2026-11-05T09:00:00Z')),
      fact('Deploys on Thursdays'),
      fact('Staging moved to devbox', 'log', 'bot', new Date('2026-11-02T09:00:00Z')),
    ];
    expect(memoryInMind(newestFirst, budget)).toEqual({
      own: ['Deploys on Thursdays', 'Uses pnpm'],
      person: ['Ana is the release manager'],
      log: ['2026-11-02: Staging moved to devbox', '2026-11-05: Ticket 412 was the login race'],
      toRecall: 0,
    });
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
    expect(memoryInMind(newestFirst, { ...budget, profileChars: 9, logChars: 4 })).toEqual({
      own: ['bbbb', 'cccc'],
      person: [],
      log: ['2026-11-03: yy', '2026-11-03: zz'],
      toRecall: 2,
    });
  });

  it('dates a log entry in the person’s time zone', () => {
    const late = fact('Shipped 0.4', 'log');
    expect(memoryInMind([late], { ...budget, timeZone: 'Europe/Madrid' }).log).toEqual([
      '2026-11-04: Shipped 0.4',
    ]);
  });
});

describe('describeKept', () => {
  it('says how a fact is kept, and which another of the person’s bots keeps', () => {
    expect(describeKept({ tier: 'log', scope: 'bot', botId: 'b1' }, 'b1')).toBe('in the log');
    expect(describeKept({ tier: 'profile', scope: 'person', botId: 'b1' }, 'b1')).toBe(
      'in mind, about the person',
    );
    expect(describeKept({ tier: 'profile', scope: 'person', botId: 'b2' }, 'b1')).toBe(
      'in mind, about the person, shared by another of their bots',
    );
  });

  it('keeps a fact the bot’s own unless it was told it is about the person', () => {
    expect([memoryScopeOf(undefined), memoryScopeOf('you'), memoryScopeOf('person')]).toEqual([
      'bot',
      'bot',
      'person',
    ]);
  });
});
