import { describe, expect, it } from 'vitest';
import { classifyTypeaheadKey, TypeaheadModel, type TypeaheadScreen } from '../lib/typeahead-model';

/**
 * A one-row grid the test types into. `host` is what the far end has drawn;
 * the model only ever reads it, the way it reads xterm's buffer.
 */
function grid(line: string, cursor: number | null, cols = 40) {
  const state = { line: line.padEnd(cols, ' '), cursor };
  const screen: TypeaheadScreen = {
    cols,
    cursor: () => (state.cursor === null ? null : { row: 0, col: state.cursor }),
    cell: (_row, col) => ({ char: state.line[col] ?? ' ', wide: false }),
  };
  return {
    screen,
    /** The host draws a new line and cursor. */
    host(next: string, nextCursor: number | null) {
      state.line = next.padEnd(cols, ' ');
      state.cursor = nextCursor;
    },
  };
}

function clock() {
  let now = 0;
  return { now: () => now, advance: (ms: number) => (now += ms) };
}

const keys = (model: TypeaheadModel, screen: TypeaheadScreen, data: string[]) => {
  for (const d of data) model.key(classifyTypeaheadKey(d), screen);
};

/** What the overlay would show on the row, laid over the host's line. */
function shown(model: TypeaheadModel, hostLine: string): { text: string; cursor: number } | null {
  const view = model.view();
  if (!view) return null;
  const cells = hostLine.padEnd(40, ' ').split('');
  let cursor = -1;
  for (const cell of view.cells) {
    cells[cell.col] = cell.char;
    if (cell.cursor) cursor = cell.col;
  }
  return { text: cells.join('').trimEnd(), cursor };
}

describe('classifyTypeaheadKey', () => {
  it('reads printable characters, Backspace and the horizontal arrows in both cursor modes', () => {
    expect(classifyTypeaheadKey('a')).toEqual({ kind: 'insert', char: 'a' });
    expect(classifyTypeaheadKey('é')).toEqual({ kind: 'insert', char: 'é' });
    expect(classifyTypeaheadKey('\x7f')).toEqual({ kind: 'backspace' });
    expect(classifyTypeaheadKey('\x1b[D')).toEqual({ kind: 'left' });
    expect(classifyTypeaheadKey('\x1bOC')).toEqual({ kind: 'right' });
  });

  it('leaves everything whose effect is the program’s to the program', () => {
    for (const data of ['\r', '\x1b[A', '\x1b[B', '\x1b', '\t', '\x03', 'paste', '漢', '😀']) {
      expect(classifyTypeaheadKey(data).kind).toBe('other');
    }
  });
});

describe('TypeaheadModel', () => {
  it('draws nothing in an epoch the host has not yet confirmed (a prompt that does not echo stays hidden)', () => {
    const { screen } = grid('Password: ', 10);
    const model = new TypeaheadModel(clock().now);
    keys(model, screen, ['s', 'e', 'c']);
    expect(model.view()).toBeNull();
  });

  it('draws the keys after the first one the host confirms, before the host echoes them', () => {
    const { screen, host } = grid('> ', 2);
    const model = new TypeaheadModel(clock().now);
    keys(model, screen, ['h']);
    host('> h', 3);
    model.reconcile(screen);
    keys(model, screen, ['e', 'y']);
    expect(shown(model, '> h')).toEqual({ text: '> hey', cursor: 5 });
  });

  it('keeps the guesses the host has not reached when it confirms an earlier one', () => {
    const { screen, host } = grid('> ', 2);
    const model = new TypeaheadModel(clock().now);
    keys(model, screen, ['a']);
    host('> a', 3);
    model.reconcile(screen);
    keys(model, screen, ['b', 'c', 'd']);
    host('> ab', 4);
    model.reconcile(screen);
    expect(shown(model, '> ab')).toEqual({ text: '> abcd', cursor: 6 });
    host('> abcd', 6);
    model.reconcile(screen);
    expect(model.waiting).toBe(false);
    expect(model.view()).toBeNull();
  });

  it('predicts editing in the middle of the line: Left, an insert that shifts the tail, Backspace, Right', () => {
    const { screen, host } = grid('> helo', 6);
    const model = new TypeaheadModel(clock().now);
    keys(model, screen, ['\x1b[D']);
    host('> helo', 5);
    model.reconcile(screen);
    keys(model, screen, ['l']);
    expect(shown(model, '> helo')).toEqual({ text: '> hello', cursor: 6 });
    keys(model, screen, ['\x7f', '\x7f']);
    expect(shown(model, '> helo')).toEqual({ text: '> heo', cursor: 4 });
    keys(model, screen, ['\x1b[C']);
    expect(shown(model, '> helo')?.cursor).toBe(5);
  });

  it('leaves text past the gap where it is (a box border does not move with the input)', () => {
    const { screen, host } = grid('│ > hi            │', 6);
    const model = new TypeaheadModel(clock().now);
    keys(model, screen, ['!']);
    host('│ > hi!           │', 7);
    model.reconcile(screen);
    keys(model, screen, ['?']);
    expect(shown(model, '│ > hi!           │')).toEqual({ text: '│ > hi!?          │', cursor: 8 });
  });

  it('drops every guess when the host draws something none of them predicted', () => {
    const { screen, host } = grid('> ', 2);
    const model = new TypeaheadModel(clock().now);
    keys(model, screen, ['a']);
    host('> a', 3);
    model.reconcile(screen);
    keys(model, screen, ['b']);
    host('> a [autocomplete]', 3);
    model.reconcile(screen);
    expect(model.view()).toBeNull();
    expect(model.waiting).toBe(false);
  });

  it('ignores output that leaves the predicted line as it was', () => {
    const { screen } = grid('> a', 3);
    const model = new TypeaheadModel(clock().now);
    keys(model, screen, ['b']);
    model.reconcile(screen);
    expect(model.waiting).toBe(true);
  });

  it('starts a tentative epoch after a key only the program understands (Up, Enter)', () => {
    const { screen, host } = grid('> ', 2);
    const model = new TypeaheadModel(clock().now);
    keys(model, screen, ['a']);
    host('> a', 3);
    model.reconcile(screen);
    keys(model, screen, ['\x1b[A', 'b']);
    expect(model.view()).toBeNull();
    host('> previous', 10);
    model.reconcile(screen);
    expect(model.view()).toBeNull();
  });

  it('does not guess past the ends of the text: Left at its start, Right at its end', () => {
    const { screen, host } = grid('> ab', 4);
    const model = new TypeaheadModel(clock().now);
    keys(model, screen, ['c']);
    host('> abc', 5);
    model.reconcile(screen);
    keys(model, screen, ['\x1b[C']);
    expect(model.waiting).toBe(false);
  });

  it('never deletes the prompt: Backspace and Left stop where the text begins', () => {
    // Claude Code draws `❯` and a no-break space (2.1), not a space.
    for (const prompt of ['\u276f\u00a0', '\u276f ', '> ', '$ ', '\u2502 > ']) {
      const { screen, host } = grid(`${prompt}a`, prompt.length + 1);
      const model = new TypeaheadModel(clock().now);
      keys(model, screen, ['b']);
      host(`${prompt}ab`, prompt.length + 2);
      model.reconcile(screen);
      // Two take back what was typed; a third, and Left, do nothing at the
      // start of the text. A guess that ate the prompt sprang back once the
      // host refused it, and one that gave up dropped the deletions before it.
      keys(model, screen, ['\x7f', '\x7f', '\x7f', '\x1b[D']);
      expect(shown(model, `${prompt}ab`)).toEqual({
        text: prompt.trimEnd(),
        cursor: prompt.length,
      });
    }
  });

  it('leaves a list bullet the reader typed deletable (`- item` is text, not prompt)', () => {
    const { screen, host } = grid('\u2502 > - a', 7);
    const model = new TypeaheadModel(clock().now);
    keys(model, screen, ['\x7f']);
    host('\u2502 > - ', 6);
    model.reconcile(screen);
    keys(model, screen, ['\x7f', '\x7f']);
    expect(shown(model, '\u2502 > - ')).toEqual({ text: '\u2502 >', cursor: 4 });
  });

  it('predicts deleting a line it did not see typed (Up recalled it)', () => {
    const { screen, host } = grid('\u276f hello', 7);
    const model = new TypeaheadModel(clock().now);
    keys(model, screen, ['\x7f']);
    host('\u276f hell', 6);
    model.reconcile(screen);
    keys(model, screen, ['\x7f', '\x7f']);
    expect(shown(model, '\u276f hell')).toEqual({ text: '\u276f he', cursor: 4 });
  });

  it('expires guesses the host has not confirmed in time', () => {
    const time = clock();
    const { screen, host } = grid('> ', 2);
    const model = new TypeaheadModel(time.now);
    keys(model, screen, ['a']);
    host('> a', 3);
    model.reconcile(screen);
    keys(model, screen, ['b']);
    time.advance(500);
    model.expire(1000);
    expect(model.waiting).toBe(true);
    time.advance(600);
    model.expire(1000);
    expect(model.waiting).toBe(false);
    expect(model.view()).toBeNull();
  });

  it('reports how long the host took to confirm each guess', () => {
    const time = clock();
    const confirmed: number[] = [];
    const { screen, host } = grid('> ', 2);
    const model = new TypeaheadModel(time.now, (ms) => confirmed.push(ms));
    keys(model, screen, ['a']);
    time.advance(80);
    host('> a', 3);
    model.reconcile(screen);
    expect(confirmed).toEqual([80]);
  });

  it('starts a tentative epoch when the program redraws the line without a key (a prompt that stops echoing)', () => {
    const { screen, host } = grid('$ ', 2);
    const model = new TypeaheadModel(clock().now);
    keys(model, screen, ['a']);
    host('$ a', 3);
    model.reconcile(screen);
    expect(model.waiting).toBe(false);
    // The command the reader typed ahead into now asks for a secret.
    host('Password: ', 10);
    keys(model, screen, ['s']);
    expect(model.view()).toBeNull();
  });

  it('keeps drawing when the line is the one the host last agreed on', () => {
    const { screen, host } = grid('> ', 2);
    const model = new TypeaheadModel(clock().now);
    keys(model, screen, ['a']);
    host('> a', 3);
    model.reconcile(screen);
    keys(model, screen, ['b']);
    expect(shown(model, '> a')).toEqual({ text: '> ab', cursor: 4 });
  });

  it('predicts nothing when the cursor cannot be found', () => {
    const { screen } = grid('> ', null);
    const model = new TypeaheadModel(clock().now);
    keys(model, screen, ['a']);
    expect(model.waiting).toBe(false);
  });
});
