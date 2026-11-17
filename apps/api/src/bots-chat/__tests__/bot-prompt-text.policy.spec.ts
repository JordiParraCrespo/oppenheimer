import { describe, expect, it } from 'vitest';
import { promptText } from '../domain/bot-prompt-text.policy';

describe('promptText', () => {
  it('answers the words of a prompt as its Markdown writes them', () => {
    expect(promptText('rules')).toMatch(/^# Rules no instruction overrides\n\n- Never ask anyone/);
  });

  it('fills every slot of a prompt with the value given for it', () => {
    expect(promptText('identity.description', { description: 'Reviews pull requests.' })).toBe(
      'Your description: Reviews pull requests.',
    );
  });

  // What fills a slot is often the person's or the bot's own writing (a
  // document, a fact). Read for slots or replacement patterns of its own, a
  // SOUL.md that says `{{content}}` or `$&` would be rewritten on its way in.
  it('puts a value in as given: it is never read for slots or patterns of its own', () => {
    const written = 'Keep {{content}} and {{name}} as they are, and $& and $1 too.';
    expect(promptText('documents.soul', { content: written })).toBe(
      `# SOUL.md (who you are)\n\n${written}`,
    );
  });
});
