import { botSessionRefusal } from '../domain/bot-session-ownership.policy';

/**
 * Whose sessions a bot may close: its own kind (origin `bot`) and no other.
 * What reaches the model is the refusal's words, so they name whose the
 * session is, in English that reads right for every origin. The tool's path
 * through a card is `bot-session-tools.factory.spec.ts`.
 */
describe('botSessionRefusal', () => {
  it('lets a bot close a session a bot started', () => {
    expect(botSessionRefusal({ id: 's-1', origin: 'bot' })).toBeNull();
  });

  // What breaks this: the refusal once read "it is a automation session".
  it.each([
    ['person', 'a person session'],
    ['automation', 'an automation session'],
    ['review', 'a review session'],
  ])('refuses a %s session, saying whose it is', (origin, words) => {
    expect(botSessionRefusal({ id: 's-1', origin })).toContain(`(it is ${words})`);
  });
});
