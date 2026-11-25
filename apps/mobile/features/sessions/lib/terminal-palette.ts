/**
 * The console's terminal ramp (`--term-*` in the web design system), as the
 * literal colours a `Text` takes. As in the console, `black` and `white` are
 * the ramp's ink and its dim rather than literal black and white, and the
 * bright slots repeat their normal ones, so a program's colours read on
 * either ground.
 */
const RAMP = {
  light: {
    bg: '#ffffff',
    fg: '#1d1d1f',
    dim: '#6e6e73',
    red: '#c11a1f',
    green: '#0b7a37',
    yellow: '#a04700',
    blue: '#0066cc',
    magenta: '#6a4bdb',
    cyan: '#00808d',
  },
  dark: {
    bg: '#1a1a1c',
    fg: '#ebebed',
    dim: '#86868b',
    red: '#ff453a',
    green: '#30d158',
    yellow: '#ff9f0a',
    blue: '#2997ff',
    magenta: '#8668ff',
    cyan: '#00a1b3',
  },
} as const;

export type TerminalScheme = keyof typeof RAMP;

const CUBE = [0, 95, 135, 175, 215, 255];

function hex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

function ansi16(scheme: TerminalScheme): string[] {
  const r = RAMP[scheme];
  const normal = [r.fg, r.red, r.green, r.yellow, r.blue, r.magenta, r.cyan, r.dim];
  const bright = [r.dim, r.red, r.green, r.yellow, r.blue, r.magenta, r.cyan, r.fg];
  return [...normal, ...bright];
}

/** The terminal's ground and ink for a scheme. */
export function terminalGround(scheme: TerminalScheme): { bg: string; fg: string } {
  return { bg: RAMP[scheme].bg, fg: RAMP[scheme].fg };
}

/**
 * A cell's colour as a `Text` takes it: a palette index (the sixteen from the
 * ramp, then xterm's 6×6×6 cube and its 24 greys), a `#rrggbb` as it is, or
 * the ground's own for an inverted default (`inverse-fg` is the ground,
 * `inverse-bg` the ink). Null is the default, drawn by the text's own style.
 */
export function terminalColour(
  value: number | string | null,
  scheme: TerminalScheme,
): string | null {
  if (value === null) return null;
  if (value === 'inverse-fg') return RAMP[scheme].bg;
  if (value === 'inverse-bg') return RAMP[scheme].fg;
  if (typeof value === 'string') return value;
  if (value < 16) return ansi16(scheme)[value] ?? null;
  if (value < 232) {
    const n = value - 16;
    return hex(CUBE[Math.floor(n / 36)] ?? 0, CUBE[Math.floor(n / 6) % 6] ?? 0, CUBE[n % 6] ?? 0);
  }
  const grey = 8 + (value - 232) * 10;
  return hex(grey, grey, grey);
}
