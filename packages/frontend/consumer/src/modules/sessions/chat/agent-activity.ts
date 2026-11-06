/**
 * What Claude Code says it is doing while a turn runs, read off its spinner
 * line: the word it picked for the moment ("Mustering", "Moonwalking", a
 * task's own "Running the tests") and what it counts beside it ("4m 31s ·
 * ↓ 15.9k tokens · thinking with medium effort"). The transcript never
 * records it; only the screen has it, so the terminal reads it there and
 * hands it to the chat.
 */
export interface ChatActivity {
  verb: string;
  /** The counts after the word, without the "esc to interrupt" hint; none when it shows none. */
  detail: string | null;
}

/**
 * The spinner line: one of the glyphs Claude Code cycles through, its word
 * ending in an ellipsis, then the counts in brackets, which open with a
 * duration ("12s", "4m 31s") or carry the interrupt hint. The brackets are
 * what tell it from a line of output that happens to start with a star.
 */
const SPINNER = /^\s*[·✢✳✶✻✽*]\s+(\S.{0,119}?)(?:…|\.\.\.)\s+\(([^)]*)\)\s*$/u;
const COUNTS = /^\s*(?:\d+[hms]\b|.*\besc to interrupt\b)/i;
const HINT = /\s*·?\s*esc to interrupt\s*·?\s*/i;

/** How many rows from the foot of the screen the spinner can sit on: under it, at most the prompt box and its hints. */
const SPINNER_REGION = 12;

/**
 * The spinner line on a screen, given as its rows top to bottom; none when
 * the agent is not working. The lowest match wins, since an earlier frame's
 * line can survive above the live one.
 */
export function readAgentActivity(rows: readonly string[]): ChatActivity | null {
  const from = Math.max(0, rows.length - SPINNER_REGION);
  for (let index = rows.length - 1; index >= from; index--) {
    const match = SPINNER.exec(rows[index] ?? '');
    if (!match) continue;
    const [, verb = '', counts = ''] = match;
    if (!COUNTS.test(counts)) continue;
    const detail = counts.replace(HINT, ' · ').replace(/^[\s·]+|[\s·]+$/g, '');
    return { verb: verb.trim(), detail: detail === '' ? null : detail };
  }
  return null;
}

/** Whether two readings say the same, so an unchanged screen publishes nothing. */
export function sameActivity(a: ChatActivity | null, b: ChatActivity | null): boolean {
  return a === b || (a !== null && b !== null && a.verb === b.verb && a.detail === b.detail);
}
