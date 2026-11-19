import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parsePromptFile, readPrompts, renderPromptModule } from '../../scripts/prompt-files.mjs';

/**
 * What a model is told is Markdown in a module's `domain/prompts/`, read by
 * the API from the `prompts.gen.ts` generated beside it. This spec holds the
 * two things that keeps true: the committed module is what the Markdown
 * generates, and a prompt file is read the way `prompt-files.mjs` says (a
 * note never sent, a broken file refused). `bot-prompt-text.policy.spec.ts`
 * covers how the words reach the code; `bot-prompt.policy.spec.ts` which are
 * sent to which bot.
 */
const SRC = join(__dirname, '..');

/** Every module's `domain/prompts`, as `emit-prompts.mjs` finds them. */
const promptDirs = readdirSync(SRC, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => join(SRC, entry.name, 'domain', 'prompts'))
  .filter((dir) => existsSync(dir));

describe('prompt files', () => {
  it('finds the modules that keep prompts', () => {
    expect(promptDirs.length).toBeGreaterThan(0);
  });

  // The words are edited in Markdown and read from the module generated from
  // them. A file edited without `generate:prompts` would leave every model on
  // the old words while the diff shows the new ones.
  it.each(promptDirs)('%s: the committed module is what its Markdown generates', (dir) => {
    const committed = readFileSync(join(dir, 'prompts.gen.ts'), 'utf8');
    expect(committed).toBe(renderPromptModule(readPrompts(dir)));
  });

  it('reads a file with no marker as one prompt, named for the file', () => {
    expect(parsePromptFile('rules.md', '\n# Rules\n\n- Never guess.\n')).toEqual([
      { id: 'rules', text: '# Rules\n\n- Never guess.', slots: [] },
    ]);
  });

  it('reads each fragment as a prompt of its own, with its slots', () => {
    const source = [
      '<!-- fragment: opening -->',
      '',
      'You are {{name}}, and {{name}} only.',
      '',
      '<!-- fragment: closing -->',
      'Ask {{owner}}.',
      '',
    ].join('\n');
    expect(parsePromptFile('identity.md', source)).toEqual([
      { id: 'identity.opening', text: 'You are {{name}}, and {{name}} only.', slots: ['name'] },
      { id: 'identity.closing', text: 'Ask {{owner}}.', slots: ['owner'] },
    ]);
  });

  // A note says why the words are what they are. One that reached the model
  // would be an instruction nobody meant to give.
  it('never sends a note: it is dropped from above the words, and refused among them', () => {
    const noted = '<!-- Added after a bot guessed a host. -->\n\nNever guess a host.\n';
    expect(parsePromptFile('rules.md', noted)[0]?.text).toBe('Never guess a host.');
    const fragment = '<!-- fragment: hosts -->\n<!-- Why. -->\n\nNever guess a host.\n';
    expect(parsePromptFile('rules.md', fragment)[0]?.text).toBe('Never guess a host.');
    expect(() => parsePromptFile('rules.md', 'Never guess.\n<!-- why -->\nAsk.\n')).toThrow(
      /above the words/,
    );
  });

  it('refuses what would be sent broken or not at all', () => {
    expect(() => parsePromptFile('rules.md', 'Before.\n<!-- fragment: a -->\nWords.')).toThrow(
      /belong to no fragment/,
    );
    expect(() => parsePromptFile('rules.md', '<!-- fragment: a -->\n\n')).toThrow(/empty/);
    expect(() => parsePromptFile('rules.md', 'Hello {{ name }}.')).toThrow(/slot/);
    expect(() => parsePromptFile('Rules.md', 'Words.')).toThrow(/kebab-case/);
    expect(() => parsePromptFile('rules.md', '<!-- fragment: Not Kebab -->\nWords.')).toThrow(
      /kebab-case/,
    );
  });

  it('types a prompt by its slots, so an unfilled one does not compile', () => {
    const module = renderPromptModule([
      { id: 'rules', text: 'Never guess.', slots: [] },
      { id: 'identity.opening', text: 'You are {{name}}.', slots: ['name'] },
    ]);
    expect(module).toContain('  | "rules"\n  | "identity.opening";');
    expect(module).toContain('  "identity.opening": { name: string };');
    expect(module).not.toContain('"rules": {');
  });
});
