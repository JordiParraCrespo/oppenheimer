/**
 * Which facts a turn keeps in mind (`25-bots.md` §4.1). What breaks this: a
 * `log` fact in every prompt, so the prompt grows with every detail kept; a
 * fact about the person drawn as the bot's own; the oldest facts kept in mind
 * when there are more than fit, where the newest should win; a bot not told
 * there is more to `recall`.
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
): RememberedFact => ({ content, tier, scope });

describe('memoryInMind', () => {
  it('keeps profile facts in mind, the person’s apart, oldest first, and counts the rest for recall', () => {
    const newestFirst = [
      fact('Uses pnpm'),
      fact('Ana is the release manager', 'profile', 'person'),
      fact('Ticket 412 was about the login race', 'log'),
      fact('Deploys on Thursdays'),
    ];
    expect(memoryInMind(newestFirst, 10)).toEqual({
      own: ['Deploys on Thursdays', 'Uses pnpm'],
      person: ['Ana is the release manager'],
      toRecall: 1,
    });
  });

  it('keeps the newest profile facts when there are more than fit, and leaves the rest to recall', () => {
    const newestFirst = [fact('c'), fact('b'), fact('a')];
    expect(memoryInMind(newestFirst, 2)).toEqual({ own: ['b', 'c'], person: [], toRecall: 1 });
  });
});

describe('describeKept', () => {
  it('says how a fact is kept, and which another of the person’s bots keeps', () => {
    expect(describeKept({ tier: 'log', scope: 'bot', botId: 'b1' }, 'b1')).toBe('to look up');
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
