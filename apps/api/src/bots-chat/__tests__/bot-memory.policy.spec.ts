/**
 * Which facts a turn keeps in mind (`25-bots.md` §4.1). What breaks this: a
 * `log` fact in every prompt, so the prompt grows with every detail kept; a
 * fact about the person drawn as the bot's own; the oldest facts kept in mind
 * when there are more than fit, where the newest should win; a bot not told
 * there is more to `recall`.
 */
import { memoryInMind, type RememberedFact } from '../domain/bot-memory.policy';

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
