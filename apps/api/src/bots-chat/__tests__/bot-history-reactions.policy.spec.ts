import { historyEntry } from '../domain/bot-history.policy';

/**
 * Reactions as a later turn reads them: a note after the message they are
 * on, marked as Oppenheimer's. Breaks if a reaction is dropped from the
 * history (the bot would react again, or miss a "thanks"), or if it reads
 * as the person's own words.
 */
describe('historyEntry with reactions', () => {
  it('notes the person’s reaction on the bot’s words', () => {
    expect(
      historyEntry({ role: 'assistant', content: 'Booked for 10:00.', reaction: '❤️' }).text,
    ).toBe('Booked for 10:00.\n\n[A note from Oppenheimer: the person reacted ❤️ to this message]');
  });

  it('notes the bot’s own reaction on the person’s message', () => {
    expect(historyEntry({ role: 'user', content: 'Book the room', botReaction: '👍' }).text).toBe(
      'Book the room\n\n[A note from Oppenheimer: you reacted 👍 to this message]',
    );
  });

  it('adds nothing to a message nobody reacted to', () => {
    expect(historyEntry({ role: 'user', content: 'Hi', reaction: null }).text).toBe('Hi');
  });
});
