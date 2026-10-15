import { botHistory, composeBotSystemPrompt } from '../domain/bot-prompt.policy';

/** What a turn tells the model: the bot as it is, and the conversation it continues. */
describe('composeBotSystemPrompt', () => {
  const base = {
    name: 'Release Bot',
    description: 'Ships changes',
    soul: '# Soul\n\nCalm.',
    instructions: '',
    facts: ['Staging is devbox.'],
    now: new Date('2026-10-15T09:00:00Z'),
  };

  it('names the bot and carries its soul, its memory and the date', () => {
    const prompt = composeBotSystemPrompt(base);
    expect(prompt).toContain('You are Release Bot');
    expect(prompt).toContain('Ships changes');
    expect(prompt).toContain('# Soul\n\nCalm.');
    expect(prompt).toContain('- Staging is devbox.');
    expect(prompt).toContain('2026-10-15');
  });

  it('asks for the job while INSTRUCTIONS.md is empty, and carries it once written', () => {
    expect(composeBotSystemPrompt(base)).toContain('You have no instructions yet');
    const written = composeBotSystemPrompt({ ...base, instructions: 'Review every PR.' });
    expect(written).toContain('Review every PR.');
    expect(written).not.toContain('You have no instructions yet');
  });
});

describe('botHistory', () => {
  it('reads back your messages and the bot’s text, not its activity lines', () => {
    expect(
      botHistory([
        { role: 'user', content: 'Hi' },
        { role: 'activity', content: '' },
        { role: 'assistant', content: 'Hello' },
      ]),
    ).toEqual([
      { role: 'user', text: 'Hi' },
      { role: 'assistant', text: 'Hello' },
    ]);
  });

  it('keeps the latest forty', () => {
    const many = Array.from({ length: 50 }, (_, index) => ({
      role: 'user' as const,
      content: String(index),
    }));
    const history = botHistory(many);
    expect(history).toHaveLength(40);
    expect(history[0].text).toBe('10');
  });
});
