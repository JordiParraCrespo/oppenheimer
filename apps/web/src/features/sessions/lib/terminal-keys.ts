/**
 * The console's keymap (05), decided before xterm encodes the key.
 *
 * xterm encodes every key it is given, which is right for almost all of them
 * and wrong for a few: a copy the reader meant for the clipboard, a paste the
 * browser should perform, the newline an agent's prompt wants inside a
 * message, and the Mac's line and word editing chords, which a Mac terminal
 * turns into the control keys a shell reads. Everything else is the program's.
 */

/**
 * - `terminal` — xterm encodes it as usual.
 * - `browser` — xterm leaves it alone and the browser's default runs (copy, paste).
 * - `send` — the console writes `data` to the PTY itself and swallows the key.
 * - `copy` — the console copies the selection itself and swallows the key.
 */
export type KeyVerdict =
  | { kind: 'terminal' }
  | { kind: 'browser' }
  | { kind: 'send'; data: string }
  | { kind: 'copy' };

export type KeyChord = Pick<
  KeyboardEvent,
  'type' | 'key' | 'shiftKey' | 'ctrlKey' | 'altKey' | 'metaKey'
>;

const TERMINAL: KeyVerdict = { kind: 'terminal' };
const BROWSER: KeyVerdict = { kind: 'browser' };

/**
 * In the agent's window, Shift+Enter is a newline in the message rather than
 * sending it: Claude Code and Codex both read a line feed (Ctrl+J) that way,
 * and it is what their own `/terminal-setup` binds the chord to. A shell
 * window gets the chord as typed — a line feed is not what a shell or an
 * editor asked for.
 */
const NEWLINE_IN_PROMPT = '\n';

/**
 * What a Mac terminal sends for the system's text-editing chords (VS Code's
 * terminal and iTerm's "natural text editing" agree): ⌘←/⌘→ go to the start
 * and end of the line, ⌘⌫ deletes to its start, ⌥←/⌥→ move by word. xterm
 * sends nothing for ⌘, and CSI 1;3 for ⌥ arrows, which neither bash nor zsh
 * binds; and ⌘← unclaimed is Chrome's Back, which leaves the session.
 */
const MAC_COMMAND = new Map([
  ['ArrowLeft', '\x01'],
  ['ArrowRight', '\x05'],
  ['Backspace', '\x15'],
]);
const MAC_OPTION = new Map([
  ['ArrowLeft', '\x1bb'],
  ['ArrowRight', '\x1bf'],
]);

export function classifyKey(
  event: KeyChord,
  context: { hasSelection: boolean; agentWindow: boolean; mac: boolean },
): KeyVerdict {
  const onlyMeta = event.metaKey && !event.shiftKey && !event.ctrlKey && !event.altKey;
  const onlyAlt = event.altKey && !event.shiftKey && !event.ctrlKey && !event.metaKey;
  const onlyShift = event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey;
  const onlyCtrl = event.ctrlKey && !event.shiftKey && !event.altKey && !event.metaKey;
  const ctrlShift = event.ctrlKey && event.shiftKey && !event.altKey && !event.metaKey;
  const key = event.key.toLowerCase();

  if (event.key === 'Enter' && onlyShift && context.agentWindow) {
    // Every phase of the key is claimed, not just keydown, or the keypress
    // that follows still reaches xterm and submits the prompt.
    return event.type === 'keydown' ? { kind: 'send', data: NEWLINE_IN_PROMPT } : BROWSER;
  }
  const macChord = context.mac
    ? (onlyMeta && MAC_COMMAND.get(event.key)) || (onlyAlt && MAC_OPTION.get(event.key))
    : undefined;
  if (macChord) return event.type === 'keydown' ? { kind: 'send', data: macChord } : BROWSER;
  // Ctrl+C is an interrupt unless something is selected, in which case it is
  // the copy a reader on Linux or Windows expects. Cmd+C on a Mac never
  // reaches the PTY, so it needs nothing here.
  if (onlyCtrl && key === 'c' && context.hasSelection) return BROWSER;
  // Ctrl+Shift+C is the terminal copy on Linux and Windows. Left to the
  // browser it opens Chrome's element inspector; with nothing selected it does
  // nothing, as in a desktop terminal.
  if (!context.mac && ctrlShift && key === 'c') {
    return event.type === 'keydown' ? { kind: 'copy' } : BROWSER;
  }
  // Ctrl+Shift+V is the terminal paste on Linux; xterm would send ^V.
  if (ctrlShift && key === 'v') return BROWSER;
  return TERMINAL;
}
