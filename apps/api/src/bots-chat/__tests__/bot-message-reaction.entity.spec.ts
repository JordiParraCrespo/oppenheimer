import { BotMessageEntity, type BotMessageProps } from '../domain/bot-message.entity';

const line = (props: Partial<BotMessageProps>) =>
  BotMessageEntity.createNew({
    organizationId: 'org',
    botId: 'bot',
    turnId: 'turn',
    role: 'assistant',
    content: 'Done.',
    steps: [],
    position: 0,
    ...props,
  });

/**
 * Your reaction to a line of a bot's chat: one emoji, on your messages and
 * the bot's words only. Breaks if a word, two emoji or a reaction to an
 * activity line is ever stored, or if the one before is kept beside it.
 */
describe('BotMessageEntity.react', () => {
  it('holds one emoji at a time, and none once taken back', () => {
    const message = line({});
    message.react('👍');
    message.react('👨‍👩‍👧');
    expect(message.reaction).toBe('👨‍👩‍👧');
    message.react(null);
    expect(message.reaction).toBeNull();
  });

  it('refuses anything that is not one emoji', () => {
    const message = line({ role: 'user', content: 'hi' });
    for (const text of ['ok', '👍👍', '👍 ', '']) {
      expect(() => message.react(text)).toThrow('A reaction is one emoji');
    }
    expect(message.reaction).toBeNull();
  });

  it('refuses a reaction on an activity line', () => {
    const activity = line({ role: 'activity', content: '' });
    expect(activity.reactable).toBe(false);
    expect(() => activity.react('👍')).toThrow('takes a reaction');
  });
});

/**
 * The bot's own reaction sits beside yours on a message of yours, and only
 * there. Breaks if the bot can react to its own words or an activity line,
 * or if its reaction replaces yours.
 */
describe('BotMessageEntity.reactAsBot', () => {
  it('keeps the bot’s reaction beside yours on your message', () => {
    const message = line({ role: 'user', content: 'Book the room' });
    message.react('🙏');
    message.reactAsBot('👍');
    expect([message.reaction, message.botReaction]).toEqual(['🙏', '👍']);
    message.reactAsBot(null);
    expect([message.reaction, message.botReaction]).toEqual(['🙏', null]);
  });

  it('refuses a bot reaction on its own words', () => {
    const reply = line({});
    expect(() => reply.reactAsBot('👍')).toThrow('only to a message of yours');
    expect(reply.botReaction).toBeNull();
  });
});
