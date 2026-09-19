import type { ITheme } from '@xterm/xterm';

/**
 * The bridge between the design system's terminal ramp and xterm.js.
 *
 * xterm takes literal colour strings, not CSS variables, so the `--term-*`
 * tokens have to be resolved against the document and handed over as values.
 * Nothing else in the app needs this: every other surface names the token and
 * lets the cascade answer. The terminal is the one place the cascade cannot
 * reach, because the grid is painted to a canvas.
 *
 * `theme-provider.tsx` toggles `.dark` / `.light` on `<html>`, so the caller
 * re-reads this whenever that class changes; the values differ per theme.
 */

/** Resolve one custom property off the document element. */
function read(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/**
 * The ten-token ramp mapped onto the sixteen ANSI slots a PTY can address.
 *
 * Two liberties, both deliberate:
 *
 * - `black` and `white` are the ramp's foreground and its dim, not literal
 *   black and white. In light mode the terminal is paper, so a program asking
 *   for "black" wants the darkest readable ink, and one asking for "white"
 *   wants the quietest — inverting them would make half of `ls` invisible.
 * - The bright slots repeat their normal counterparts. A separate bright ramp
 *   is a design decision the tokens do not carry yet; `minimumContrastRatio`
 *   in the terminal options keeps output legible until it does.
 */
export function readTerminalTheme(): ITheme {
  const fg = read('--term-fg');
  const dim = read('--term-dim');
  const red = read('--term-danger');
  const green = read('--term-success');
  const yellow = read('--term-warning');
  const blue = read('--term-accent');
  const magenta = read('--term-magenta');
  const cyan = read('--term-cyan');

  return {
    background: read('--term-bg'),
    foreground: fg,
    cursor: read('--term-caret'),
    cursorAccent: read('--term-bg'),
    selectionBackground: read('--term-selection'),

    black: fg,
    red,
    green,
    yellow,
    blue,
    magenta,
    cyan,
    white: dim,

    brightBlack: dim,
    brightRed: red,
    brightGreen: green,
    brightYellow: yellow,
    brightBlue: blue,
    brightMagenta: magenta,
    brightCyan: cyan,
    brightWhite: fg,
  };
}

/** The type face and metrics the ramp was drawn for. */
export const TERMINAL_FONT = {
  fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
  fontSize: 13,
  lineHeight: 1.55,
} as const;
