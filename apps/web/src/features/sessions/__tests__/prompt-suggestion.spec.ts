import { Terminal } from '@xterm/xterm';
import { describe, expect, it } from 'vitest';
import { bindPromptSuggestion } from '../lib/prompt-suggestion';

/**
 * The suggestion is told from typed words by style alone, so this runs a real
 * xterm: the regression is a colour Claude Code draws a suggestion in read as
 * full strength (nothing offered), or the person's own words read as faint
 * (their draft offered back to them).
 */

const RULE = '─'.repeat(40);

/** Claude Code's foot after a turn, with `input` in the box after the prompt and its cursor. */
const foot = (input: string) =>
  `done\r\n\r\n${RULE}\r\n❯ \u001b[7m${input.slice(0, 1)}\u001b[27m${input.slice(1)}\u001b[0m\r\n${RULE}\r\n  ? for shortcuts`;

async function read(screen: string): Promise<string | null> {
  const term = new Terminal({ cols: 60, rows: 8, allowProposedApi: true });
  const seen: (string | null)[] = [];
  const unbind = bindPromptSuggestion(term, (suggestion) => seen.push(suggestion));
  await new Promise<void>((done) => term.write(screen, done));
  // The reader waits a quarter second after output lands, as it does live.
  await new Promise((settled) => setTimeout(settled, 300));
  unbind();
  term.dispose();
  return seen[0] ?? null;
}

describe('bindPromptSuggestion', () => {
  it.each([
    ['the dark theme’s grey', '\u001b[38;2;153;153;153m'],
    ['the light theme’s grey', '\u001b[38;2;102;102;102m'],
    ['bright black, under an ANSI-only theme', '\u001b[90m'],
    ['dim', '\u001b[2m'],
  ])('reads a suggestion drawn in %s', async (_, style) => {
    expect(await read(foot(`s${style}ave it to a file`))).toBe('save it to a file');
  });

  it.each([
    ['the default colour', ''],
    ['white', '\u001b[38;2;255;255;255m'],
  ])('never offers words typed in %s', async (_, style) => {
    expect(await read(foot(`s${style}ave it to a file`))).toBeNull();
  });
});
