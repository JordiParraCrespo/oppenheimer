import type { ITheme } from '@xterm/xterm';

/**
 * The bridge between the design system's terminal ramp and xterm.js. xterm
 * paints to a canvas and takes literal colours, not CSS variables, so the
 * `--term-*` tokens are resolved against the document. The values differ per
 * theme, so the caller re-reads them whenever `theme-provider.tsx` toggles
 * `.dark` / `.light` on `<html>`.
 */

/**
 * The contrast floor xterm holds every colour to, by how light the terminal's
 * background is. 4.5 (WCAG-AA body text) rescues near-white output on a light
 * terminal but on a dark one over-brightens saturated colour (Claude's mark
 * turns washed out rather than orange); 3 (AA large-text) still lifts text
 * sitting almost on the background. Gated on the resolved background, not the
 * theme class, because the terminal keeps its own ramp. The thresholds are
 * Orca's (`src/renderer/src/lib/terminal-contrast-correction.ts`).
 */
export function terminalMinimumContrastRatio(): number {
  return isLightBackground(read('--term-bg')) ? 4.5 : 3;
}

/** Relative luminance, the sRGB way, for a `#rgb` or `#rrggbb` background. */
function isLightBackground(hex: string): boolean {
  const clean = hex.replace('#', '').trim();
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  if (full.length !== 6) return true; // an unreadable value is treated as paper
  const channel = (from: number) => {
    const v = Number.parseInt(full.slice(from, from + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
  return luminance > 0.5;
}

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

/**
 * The type face the ramp was drawn for. A browser skips a family it lacks, so
 * naming every platform's mono face is free and keeps the grid off a
 * proportional font. The tail is for agent output: Claude Code and Codex draw
 * with glyphs no stock mono face carries in full (`⏺` U+23FA, `✻` U+273B,
 * `❯` U+276F, box drawing, Powerline, private use), and a missing one is drawn
 * as a stray substitute. The symbol-only Nerd Font faces, on most developer
 * machines, supply them.
 */
const TERMINAL_FONT_STACK = [
  'ui-monospace',
  '"SF Mono"',
  'Menlo',
  'Monaco',
  '"Cascadia Mono"',
  'Consolas',
  '"DejaVu Sans Mono"',
  '"Liberation Mono"',
  // Bundled, so it is the one fallback that is always there. Its `@font-face`
  // in the design system claims only the symbol blocks and the private-use
  // planes, so it never wins a letter or a digit a real font should draw.
  "'Oppenheimer Symbols'",
  '"Symbols Nerd Font Mono"',
  '"MesloLGS Nerd Font"',
  '"JetBrainsMono Nerd Font"',
  '"Hack Nerd Font"',
  'monospace',
];

/**
 * The families the stack names, unquoted, so a font that finishes loading can
 * be told apart from one the terminal never asked for.
 */
export const TERMINAL_FONT_FAMILIES: ReadonlySet<string> = new Set(
  TERMINAL_FONT_STACK.map((family) => family.replace(/^["']|["']$/g, '')),
);

export const TERMINAL_FONT = {
  fontFamily: TERMINAL_FONT_STACK.join(', '),
  fontSize: 13,
  /**
   * 1.3, between the glyphs' own 1 and `terminal.css`'s 1.55. xterm's
   * `lineHeight` multiplies the cell rather than adding leading, and the WebGL
   * renderer draws block and box characters to fill it: at 1.55 Claude Code's
   * mark came out elongated, and at 1 a turn's tool calls, results and prose
   * packed into a wall the artboard's transcript never was. 1.3 gives each
   * row air and keeps boxes joined and the mark close to its shape.
   */
  lineHeight: 1.3,
} as const;
