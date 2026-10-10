import { describe, expect, it } from 'vitest';
import { type EchoGrid, EchoPredictor } from '../lib/local-echo';

/**
 * `EchoPredictor` decides which keys the terminal draws before the relay
 * brings their echo back. Wrong one way, typing lags as it did; wrong the
 * other, the console paints what the program never printed: a password, or
 * a key an editor took as a command.
 *
 * The grid is one line of text with the cursor at `cursorX`, the way the
 * runner's tmux leaves Claude Code's prompt: `❯ ` and the caret after it.
 */
function line(text: string, cursorX: number, cols = 40): EchoGrid {
  return { cursorX, cursorY: 0, cols, char: (x, y) => (y === 0 ? (text[x] ?? '') : '') };
}

const visibleText = (predictor: EchoPredictor) =>
  predictor
    .visible()
    .map((p) => p.char)
    .join('');

describe('EchoPredictor', () => {
  it('draws nothing until the program has echoed a key on the line', () => {
    const predictor = new EchoPredictor();
    predictor.type('s', line('❯ ', 2), 0);
    expect(visibleText(predictor)).toBe('');
  });

  it('draws the keys typed after the first echo, where the program will put them', () => {
    const predictor = new EchoPredictor();
    predictor.type('h', line('❯ ', 2), 0);
    predictor.reconcile(line('❯ h', 3), 120);
    predictor.type('e', line('❯ h', 3), 130);
    predictor.type('y', line('❯ h', 3), 140);
    expect(predictor.visible().map(({ x, char }) => [x, char])).toEqual([
      [3, 'e'],
      [4, 'y'],
    ]);
  });

  it('lets a prediction go once the grid shows it and the cursor has passed it', () => {
    const predictor = new EchoPredictor();
    predictor.type('h', line('❯ ', 2), 0);
    predictor.reconcile(line('❯ h', 3), 120);
    predictor.type('i', line('❯ h', 3), 130);
    // A placeholder that happens to match is not an echo: the cursor has not moved.
    predictor.reconcile(line('❯ hi', 3), 140);
    expect(visibleText(predictor)).toBe('i');
    predictor.reconcile(line('❯ hi', 4), 250);
    expect(visibleText(predictor)).toBe('');
  });

  it('drops everything and waits on real echoes after a wrong guess', () => {
    const predictor = new EchoPredictor();
    predictor.type('h', line('❯ ', 2), 0);
    predictor.reconcile(line('❯ h', 3), 120);
    predictor.type('j', line('❯ h', 3), 130);
    // The program put something else where the key was predicted.
    predictor.reconcile(line('❯ hx', 4), 250);
    expect(predictor.visible()).toEqual([]);
    predictor.type('k', line('❯ hx', 4), 300);
    predictor.reconcile(line('❯ hxk', 5), 420);
    predictor.type('l', line('❯ hxk', 5), 430);
    expect(predictor.visible()).toEqual([]);
  });

  it('takes away a key nobody echoed', () => {
    const predictor = new EchoPredictor();
    predictor.type('h', line('❯ ', 2), 0);
    predictor.reconcile(line('❯ h', 3), 100);
    predictor.type('x', line('❯ h', 3), 200);
    predictor.reconcile(line('❯ h', 3), 200 + 749);
    expect(visibleText(predictor)).toBe('x');
    predictor.reconcile(line('❯ h', 3), 200 + 750);
    expect(predictor.visible()).toEqual([]);
  });

  it('starts every line unconfirmed again, so a password prompt after Enter is never drawn', () => {
    const predictor = new EchoPredictor();
    predictor.type('s', line('$ ', 2), 0);
    predictor.reconcile(line('$ s', 3), 100);
    predictor.type('\r', line('$ s', 3), 200);
    predictor.type('p', line('Password: ', 10), 300);
    predictor.type('w', line('Password: ', 10), 310);
    expect(predictor.visible()).toEqual([]);
  });

  it('erases a key typed and deleted before its echo arrived', () => {
    const predictor = new EchoPredictor();
    predictor.type('h', line('❯ ', 2), 0);
    predictor.reconcile(line('❯ h', 3), 100);
    predictor.type('a', line('❯ h', 3), 110);
    predictor.type('b', line('❯ h', 3), 120);
    predictor.type('\x7f', line('❯ h', 3), 130);
    expect(visibleText(predictor)).toBe('a');
  });

  it('stops guessing at the end of the line, where the program decides the wrap', () => {
    const predictor = new EchoPredictor();
    predictor.type('a', line('❯ ', 2, 4), 0);
    predictor.reconcile(line('❯ a', 3, 4), 100);
    predictor.type('b', line('❯ a', 3, 4), 110);
    predictor.type('c', line('❯ a', 3, 4), 120);
    expect(predictor.visible()).toEqual([]);
  });

  it('guesses nothing about a paste, an arrow or a chord', () => {
    const predictor = new EchoPredictor();
    predictor.type('h', line('❯ ', 2), 0);
    predictor.reconcile(line('❯ h', 3), 100);
    predictor.type('\x1b[D', line('❯ h', 3), 110);
    predictor.type('i', line('❯ h', 3), 120);
    expect(predictor.visible()).toEqual([]);
  });
});
