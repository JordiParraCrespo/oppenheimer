/**
 * The console's keymap (05), decided before xterm encodes the key: the chords
 * the console answers are rows of `CHORDS`, and every other key is the
 * program's.
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

export interface KeyContext {
  hasSelection: boolean;
  agentWindow: boolean;
  mac: boolean;
}

type Modifier = 'ctrl' | 'shift' | 'alt' | 'meta';

interface ChordRow {
  /** `mac` or `other` fences a row to one side; absent, it holds on both. */
  platform?: 'mac' | 'other';
  /** Exactly these modifiers are down, and no others. */
  mods: Modifier[];
  key: string;
  /** The row holds only in window 0, the agent's (Shift+Enter). */
  agentWindow?: true;
  /** The row holds only while text is selected (Ctrl+C). */
  selection?: true;
  verdict: KeyVerdict;
}

const TERMINAL: KeyVerdict = { kind: 'terminal' };
const BROWSER: KeyVerdict = { kind: 'browser' };

/** 05's chords, first match wins. */
const CHORDS: ChordRow[] = [
  // A line feed is a newline in Claude Code's and Codex's prompt.
  { mods: ['shift'], key: 'Enter', agentWindow: true, verdict: { kind: 'send', data: '\n' } },
  { mods: ['ctrl'], key: 'c', selection: true, verdict: BROWSER },
  { platform: 'other', mods: ['ctrl', 'shift'], key: 'c', verdict: { kind: 'copy' } },
  { mods: ['ctrl', 'shift'], key: 'v', verdict: BROWSER },
  { platform: 'mac', mods: ['meta'], key: 'ArrowLeft', verdict: { kind: 'send', data: '\x01' } },
  { platform: 'mac', mods: ['meta'], key: 'ArrowRight', verdict: { kind: 'send', data: '\x05' } },
  { platform: 'mac', mods: ['meta'], key: 'Backspace', verdict: { kind: 'send', data: '\x15' } },
  { platform: 'mac', mods: ['alt'], key: 'ArrowLeft', verdict: { kind: 'send', data: '\x1bb' } },
  { platform: 'mac', mods: ['alt'], key: 'ArrowRight', verdict: { kind: 'send', data: '\x1bf' } },
];

function held(event: KeyChord): Set<Modifier> {
  const mods = new Set<Modifier>();
  if (event.ctrlKey) mods.add('ctrl');
  if (event.shiftKey) mods.add('shift');
  if (event.altKey) mods.add('alt');
  if (event.metaKey) mods.add('meta');
  return mods;
}

function matches(row: ChordRow, event: KeyChord, down: Set<Modifier>, context: KeyContext) {
  if (row.platform && row.platform !== (context.mac ? 'mac' : 'other')) return false;
  if (row.agentWindow && !context.agentWindow) return false;
  if (row.selection && !context.hasSelection) return false;
  if (row.key.toLowerCase() !== event.key.toLowerCase()) return false;
  return row.mods.length === down.size && row.mods.every((mod) => down.has(mod));
}

export function classifyKey(event: KeyChord, context: KeyContext): KeyVerdict {
  const down = held(event);
  const row = CHORDS.find((candidate) => matches(candidate, event, down, context));
  if (!row) return TERMINAL;
  // A verdict that acts (writes the PTY or the clipboard) acts once, on
  // keydown; the keypress and keyup of the same chord are claimed too, or
  // xterm encodes the keypress after the console has already answered it.
  const acts = row.verdict.kind === 'send' || row.verdict.kind === 'copy';
  return acts && event.type !== 'keydown' ? BROWSER : row.verdict;
}
