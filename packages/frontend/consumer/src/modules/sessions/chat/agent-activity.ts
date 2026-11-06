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
 * what tell it from a line of output that happens to start with a star. A
 * line wider than the screen comes cut short or wrapped, so the closing
 * bracket may be missing; what the counts open with still tells it.
 */
const SPINNER = /^\s*[·✢✳✶✻✽*]\s+(\S.{0,119}?)(?:…|\.\.\.)\s+\(([^)]*)(\))?\s*$/u;
const COUNTS = /^\s*(?:\d+[hms]\b|.*\besc to interrupt\b)/i;
const HINT = /\s*·?\s*esc to interrupt\s*·?\s*/i;

/**
 * Claude Code leaves its last spinner frame on screen when it stops to ask
 * (a permission, an edit, a numbered Yes / No). The same phrases the runner's
 * manifest reads as `blocked` (`manifests/claude.json`, `question`) say the
 * line above them is not work in progress.
 */
const ASKING = [
  /\bdo you want to (?:proceed|continue|allow|make|create)\b/i,
  /\b(?:waiting for (?:your )?(?:permission|input|approval|confirmation)|(?:permission|approval) (?:needed|required))\b/i,
  /\bpress enter to (?:continue|confirm)\b/i,
  /[([]\s*y\/n\s*[)\]]/i,
  /^\s*(?:[❯›>▶➤]\s*)?\d\.\s+(?:yes|no)\b/i,
];

/** How many rows a spinner line wrapped onto past its first: its counts never run longer. */
const WRAPPED_ROWS = 2;

/**
 * The spinner line on a screen, given as its rows top to bottom; none when
 * the agent is not working, or when it stopped under the spinner to ask
 * something. The whole screen is read, since a todo list or a
 * long draft can stand between the spinner and the foot. The lowest match
 * wins, since an earlier frame's line can survive above the live one. A line
 * whose bracket is still open takes the rows under it when they close it,
 * the way a narrow screen wrapped it.
 */
export function readAgentActivity(rows: readonly string[]): ChatActivity | null {
  for (let index = rows.length - 1; index >= 0; index--) {
    let line = rows[index] ?? '';
    let match = SPINNER.exec(line);
    // The rows under an open bracket are its tail only if they close it;
    // otherwise they are what Claude Code drew under a line it cut short.
    for (let next = 1; match && !match[3] && next <= WRAPPED_ROWS; next++) {
      const row = rows[index + next]?.trim();
      if (!row) break;
      line = `${line.trimEnd()} ${row}`;
      const joined = SPINNER.exec(line);
      if (joined?.[3]) match = joined;
    }
    if (!match) continue;
    const [, verb = '', counts = ''] = match;
    if (!COUNTS.test(counts)) continue;
    if (rows.slice(index + 1).some((row) => ASKING.some((asking) => asking.test(row)))) return null;
    const detail = counts.replace(HINT, ' · ').replace(/^[\s·]+|[\s·]+$/g, '');
    return { verb: verb.trim(), detail: detail === '' ? null : detail };
  }
  return null;
}

/** Whether two readings say the same, so an unchanged screen publishes nothing. */
export function sameActivity(a: ChatActivity | null, b: ChatActivity | null): boolean {
  return a === b || (a !== null && b !== null && a.verb === b.verb && a.detail === b.detail);
}
