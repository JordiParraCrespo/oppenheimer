import { describe, expect, it } from 'vitest';
import { promptText } from '../domain/bot-prompt-text.policy';

/**
 * `promptText` is the one way a prompt's words reach the code: by id, with
 * its slots filled. This proves the words come back as their Markdown writes
 * them and that what fills a slot is put in untouched. Which prompts a bot is
 * sent is `bot-prompt.policy.spec.ts`; how a prompt file is read,
 * `src/__tests__/prompt-files.spec.ts`.
 */
describe('promptText', () => {
  it('answers the words of a prompt as its Markdown writes them', () => {
    expect(promptText('system/rules')).toMatch(
      /^# Rules no instruction overrides\n\n- Never ask anyone/,
    );
  });

  it('fills every slot of a prompt with the value given for it', () => {
    expect(
      promptText('system/identity.description', { description: 'Reviews pull requests.' }),
    ).toBe('Your description: Reviews pull requests.');
  });

  // What fills a slot is often the person's or the bot's own writing (a
  // document, a fact). Read for slots or replacement patterns of its own, a
  // SOUL.md that says `{{content}}` or `$&` would be rewritten on its way in.
  it('puts a value in as given: it is never read for slots or patterns of its own', () => {
    const written = 'Keep {{content}} and {{name}} as they are, and $& and $1 too.';
    expect(promptText('system/documents.soul', { content: written })).toBe(
      `# SOUL.md (who you are)\n\n${written}`,
    );
  });

  // The types refuse an unfilled slot, but a cast or an untyped caller gets
  // past them, and the model would then read a literal `{{description}}`.
  it('refuses a slot nothing was given for, rather than send the placeholder', () => {
    expect(() => promptText('system/identity.description', {} as never)).toThrow(
      'Prompt system/identity.description was given nothing for {{description}}.',
    );
  });
});
