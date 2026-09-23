import { describe, expect, it } from 'vitest';
import { type AnchorBuffer, emptyRowsBelowContent } from '../lib/terminal-anchor';

/** A screen of `rows` rows with `lines` written from the top. */
function screen(
  lines: string[],
  {
    rows = 10,
    cursorY = lines.length - 1,
    baseY = 0,
    viewportY = baseY,
  }: Partial<Omit<AnchorBuffer, 'rowText'>> = {},
): AnchorBuffer {
  return { rows, baseY, viewportY, cursorY, rowText: (y) => (lines[y] ?? '').trimEnd() };
}

/**
 * The rule that keeps the agent's prompt on the pane's last rows. What it
 * returns is how far the picture moves down, in rows.
 */
describe('emptyRowsBelowContent', () => {
  it('moves a fresh session down until its last line is the last row', () => {
    const banner = [
      '✻ Welcome to Claude Code',
      '',
      '╭──────╮',
      '│ >    │',
      '╰──────╯',
      '  ? for shortcuts',
    ];
    expect(emptyRowsBelowContent(screen(banner, { cursorY: 3 }))).toBe(4);
  });

  it('puts a cleared shell prompt on the bottom row', () => {
    expect(emptyRowsBelowContent(screen(['$ '], { cursorY: 0 }))).toBe(9);
  });

  it('leaves a full screen where it is', () => {
    const full = Array.from({ length: 10 }, (_, i) => `line ${i}`);
    expect(emptyRowsBelowContent(screen(full))).toBe(0);
  });

  it('counts a row with only spaces as empty — tmux paints blank rows', () => {
    expect(emptyRowsBelowContent(screen(['$ ls', 'a  b', '      ', '   '], { cursorY: 1 }))).toBe(
      8,
    );
  });

  it('keeps the cursor on screen when it sits below the last written row', () => {
    // A shell that has printed a newline and not yet its prompt.
    expect(emptyRowsBelowContent(screen(['output'], { cursorY: 2 }))).toBe(7);
  });

  it('keeps content drawn below the cursor, like a hint line under the prompt', () => {
    expect(emptyRowsBelowContent(screen(['> ', '', '', 'hint'], { cursorY: 0 }))).toBe(6);
  });

  it('does not move anything while the reader is scrolled back', () => {
    expect(emptyRowsBelowContent(screen(['$ '], { cursorY: 0, baseY: 40, viewportY: 12 }))).toBe(0);
  });

  it('is zero for a grid with no rows yet', () => {
    expect(emptyRowsBelowContent(screen([], { rows: 0, cursorY: 0 }))).toBe(0);
  });
});
