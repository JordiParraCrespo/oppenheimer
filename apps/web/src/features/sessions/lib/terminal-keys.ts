/**
 * The keys the console decides before xterm does.
 *
 * xterm encodes every key it is given, which is right for almost all of them
 * and wrong for three: a copy the reader meant for the clipboard, a paste the
 * browser should perform, and the newline an agent's prompt wants inside a
 * message. Everything else is the program's.
 */

/**
 * - `terminal` — xterm encodes it as usual.
 * - `browser` — xterm leaves it alone and the browser's default runs (copy, paste).
 * - `send` — the console writes `data` to the PTY itself and swallows the key.
 */
export type KeyVerdict =
  | { kind: 'terminal' }
  | { kind: 'browser' }
  | { kind: 'send'; data: string };

export type KeyChord = Pick<
  KeyboardEvent,
  'type' | 'key' | 'shiftKey' | 'ctrlKey' | 'altKey' | 'metaKey'
>;

const TERMINAL: KeyVerdict = { kind: 'terminal' };
const BROWSER: KeyVerdict = { kind: 'browser' };

/**
 * Shift+Enter is a newline in the message rather than sending it. Claude Code
 * and Codex both read a line feed (Ctrl+J) that way, and it is what their own
 * `/terminal-setup` binds the chord to; xterm alone would send a carriage
 * return, which submits.
 */
const NEWLINE_IN_PROMPT = '\n';

export function classifyKey(event: KeyChord, context: { hasSelection: boolean }): KeyVerdict {
  const onlyShift = event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey;
  const onlyCtrl = event.ctrlKey && !event.shiftKey && !event.altKey && !event.metaKey;
  const ctrlShift = event.ctrlKey && event.shiftKey && !event.altKey && !event.metaKey;
  const key = event.key.toLowerCase();

  if (event.key === 'Enter' && onlyShift) {
    // Every phase of the key is claimed, not just keydown, or the keypress
    // that follows still reaches xterm and submits the prompt.
    return event.type === 'keydown' ? { kind: 'send', data: NEWLINE_IN_PROMPT } : BROWSER;
  }
  // Ctrl+C is an interrupt unless something is selected, in which case it is
  // the copy a reader on Linux or Windows expects. Cmd+C on a Mac never
  // reaches the PTY, so it needs nothing here.
  if (onlyCtrl && key === 'c' && context.hasSelection) return BROWSER;
  // Ctrl+Shift+V is the terminal paste on Linux; xterm would send ^V.
  if (ctrlShift && key === 'v') return BROWSER;
  return TERMINAL;
}
