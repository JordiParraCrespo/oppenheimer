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
