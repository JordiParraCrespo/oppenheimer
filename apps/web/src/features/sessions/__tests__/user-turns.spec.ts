import { describe, expect, it } from 'vitest';
import { findUserTurns, type TurnGrid } from '../lib/user-turns';

/**
 * `findUserTurns` decides which rows the console redraws as the reader's own
 * message (the artboard's `op-term__you`). Getting it wrong either way is
 * visible: a missed turn stays Claude's grey strip, and a false one puts a
 * bubble behind output the reader never wrote.
 *
 * A grid is written as text with the user background marked by `[` … `]`:
 * the brackets take no cell, everything between them is on the background.
 */
function grid(rows: string[]): TurnGrid {
  const cells = rows.map((row) => {
    const line: { char: string; user: boolean }[] = [];
    let user = false;
    for (const char of row) {
      if (char === '[') user = true;
      else if (char === ']') user = false;
      else line.push({ char, user });
    }
    return line;
  });
  const cols = Math.max(...cells.map((line) => line.length));
  return {
    lines: cells.length,
    cols,
    char: (line, x) => cells[line]?.[x]?.char ?? ' ',
    userBackground: (line, x) => cells[line]?.[x]?.user ?? false,
  };
}

describe('findUserTurns', () => {
  it('finds a message Claude Code drew: the pointer and its text on the background', () => {
    const turns = findUserTurns(
      grid(['', '[❯ Review the diff against CONTRIBUTING.md ]', '', '⏺ Read(CONTRIBUTING.md)']),
    );
    expect(turns).toEqual([{ line: 1, x: 0, pointerX: 0, height: 1 }]);
  });

  it('keeps a wrapped or multi-line message as one turn', () => {
    const turns = findUserTurns(
      grid([
        '[❯ Review the diff. Leave inline comments only for real ]',
        '[  problems, then post one summary comment.             ]',
        '[  Approve, or the changes you need.                    ]',
        '⏺ On it.',
      ]),
    );
    expect(turns).toEqual([{ line: 0, x: 0, pointerX: 0, height: 3 }]);
  });

  it('keeps two messages on consecutive rows apart', () => {
    const turns = findUserTurns(grid(['[❯ first ]', '[❯ second ]']));
    expect(turns.map((turn) => turn.line)).toEqual([0, 1]);
  });

  it('finds a message drawn in from the margin', () => {
    const turns = findUserTurns(grid(['  [ ❯ indented ]']));
    expect(turns).toEqual([{ line: 0, x: 2, pointerX: 3, height: 1 }]);
  });

  it('ignores grey that does not open on the pointer', () => {
    // The same grey behind a selected menu row, a highlighted diff line, a
    // status chip: none of them is something the reader wrote.
    expect(findUserTurns(grid(['[  selected option ]', '[+ added line ]']))).toEqual([]);
  });

  it('ignores a pointer on the background after other output on the row', () => {
    expect(findUserTurns(grid(['done [❯ not a turn ]']))).toEqual([]);
  });

  it('ignores the prompt the agent is still taking input in', () => {
    // Claude's own input row carries the pointer without the background.
    expect(findUserTurns(grid(['❯ Continue this run']))).toEqual([]);
  });
});
