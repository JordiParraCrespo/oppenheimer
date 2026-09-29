import { describe, expect, it } from 'vitest';
import { hasVisibleText } from '../lib/terminal-runtime';

/**
 * `hasVisibleText` decides when the "waiting for the agent" cover comes off
 * the grid, so it has to answer the reader's question — has anything been
 * drawn — rather than the socket's. An attachment opens with tmux's preamble,
 * which is bytes that paint nothing; counting those as output put the reader
 * straight back in front of the blank rectangle the cover exists to explain.
 */
describe('hasVisibleText', () => {
  it('is false for what a fresh attachment opens with', () => {
    // The alternate-screen and bracketed-paste toggles, a clear, the cursor
    // put home, a device-attributes query, an OSC colour query. No glyphs.
    for (const preamble of [
      '\u001b[?1049h\u001b[?2004h',
      '\u001b[H\u001b[2J\u001b[3J',
      '\u001b[c',
      '\u001b]11;?\u0007',
      '\u001b]0;a title\u001b\\',
      '\u001b7\u001b8',
    ]) {
      expect(hasVisibleText(preamble), preamble).toBe(false);
    }
  });

  it('is false for whitespace, however much of it', () => {
    // A cleared screen arrives as spaces and newlines; a pane of those still
    // reads as blank.
    expect(hasVisibleText('')).toBe(false);
    expect(hasVisibleText('\r\n\r\n   \t  \r\n')).toBe(false);
    expect(hasVisibleText(`\u001b[2J${' '.repeat(200)}\r\n`)).toBe(false);
  });

  it('is true once a glyph rides along, colours and all', () => {
    expect(hasVisibleText('\u001b[38;5;208m▐▛███▛█\u001b[0m  Claude Code v2.1.284\r\n')).toBe(true);
    expect(hasVisibleText('\u001b[H\u001b[2J❯ ')).toBe(true);
    expect(hasVisibleText('2')).toBe(true);
  });

  it('reads a binary frame the same way', () => {
    const bytes = (text: string) => new TextEncoder().encode(text);
    expect(hasVisibleText(bytes('\u001b[2J\u001b[H'))).toBe(false);
    expect(hasVisibleText(bytes('❯ ready'))).toBe(true);
  });
});
