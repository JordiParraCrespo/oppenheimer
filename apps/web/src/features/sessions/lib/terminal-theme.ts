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

/**
 * The contrast floor xterm holds every colour to, chosen by how light the
 * terminal's own background is.
 *
 * A single floor cannot serve both themes. 4.5 (WCAG-AA body text) is what
 * rescues a program's near-white output on a light terminal, and on a dark one
 * the same number over-brightens saturated colour until an agent's palette
 * stops looking like itself — which is why Claude's mark arrives washed out
 * rather than orange. 3 (AA large-text) is the milder floor that still lifts
 * text sitting almost on top of the background.
 *
 * Gated on the resolved background rather than the app's theme class, because
 * the two can disagree: the terminal keeps its own ramp, and it is the
 * background a colour is actually read against that decides legibility.
 *
 * The thresholds and the reasoning are Orca's
 * (`src/renderer/src/lib/terminal-contrast-correction.ts`), which arrived at
 * them from the same symptom.
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

/**
 * The type face and metrics the ramp was drawn for.
 *
 * The chain is long on purpose. A browser skips a family it does not have, so
 * naming every platform's mono face costs nothing and means the grid never
 * falls through to a proportional font — which is why `ui-monospace` leads.
 *
 * The tail is what matters for agent output. Claude Code and Codex draw their
 * turns with characters no stock mono face carries in full — `⏺` (U+23FA),
 * `✻` (U+273B), `❯` (U+276F), box drawing, Powerline and the private-use
 * range — and a glyph the chain cannot supply is drawn as a substitute, which
 * is why every agent line opened with a stray mark instead of its bullet. The
 * symbol-only Nerd Font faces are the usual fix and are already installed on
 * most developer machines; naming them is free on machines without them.
 *
 * Orca solves the same problem the same way and goes one step further by
 * *bundling* a symbols face, so a machine with none still renders the glyphs.
 * Shipping a webfont is a size and licensing decision this has not taken, so
 * the chain relies on what the host already has.
 */
export const TERMINAL_FONT = {
  fontFamily: [
    'ui-monospace',
    '"SF Mono"',
    'Menlo',
    'Monaco',
    '"Cascadia Mono"',
    'Consolas',
    '"DejaVu Sans Mono"',
    '"Liberation Mono"',
    // Bundled, so it is the one fallback that is always there. It claims only
    // the private-use ranges (`@font-face` in the design system), so it never
    // wins a character a real font should draw.
    "'Oppenheimer Symbols'",
    '"Symbols Nerd Font Mono"',
    '"MesloLGS Nerd Font"',
    '"JetBrainsMono Nerd Font"',
    '"Hack Nerd Font"',
    'monospace',
  ].join(', '),
  fontSize: 13,
  /**
   * 1, not the ramp's 1.55.
   *
   * `terminal.css` sets `line-height: 1.55` for its scrollback, and that is
   * right for HTML: leading between wrapped prose. xterm's `lineHeight` is not
   * leading — it multiplies the cell itself, so 1.55 makes every cell half as
   * tall again as it is wide, and the block characters agents draw their
   * banners and progress bars from stretch with it. Claude Code's mark arrived
   * elongated for exactly that reason. 1 is the ratio the glyphs were drawn
   * for, and it is Orca's default too.
   */
  lineHeight: 1,
} as const;
