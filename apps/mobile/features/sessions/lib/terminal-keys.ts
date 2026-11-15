/**
 * The keys a phone's keyboard does not have, in the row over the reply
 * field, as the export draws them. `ctrl` is a modifier, not a key: it holds
 * until the next letter, which it turns into its control code.
 */
export const TERMINAL_KEYS = [
  { id: 'esc', label: 'esc', sends: '\u001b' },
  { id: 'tab', label: 'tab', sends: '\t' },
  { id: 'ctrl', label: 'ctrl', sends: null },
  { id: 'interrupt', label: '^C', sends: '\u0003' },
  { id: 'up', label: '↑', sends: '\u001b[A' },
  { id: 'down', label: '↓', sends: '\u001b[B' },
  { id: 'left', label: '←', sends: '\u001b[D' },
  { id: 'right', label: '→', sends: '\u001b[C' },
] as const;

export type TerminalKey = (typeof TERMINAL_KEYS)[number];

/**
 * What a typed character sends while `ctrl` is held: a letter (either case)
 * or one of `@[\]^_` as its control code, as a terminal's keyboard does.
 * Anything else has no control code and goes as it is.
 */
export function withCtrl(char: string): string {
  if (char.length !== 1) return char;
  const code = char.toUpperCase().charCodeAt(0);
  return code >= 64 && code <= 95 ? String.fromCharCode(code - 64) : char;
}
