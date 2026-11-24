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
  /**
   * What the command in flight last printed, as Claude Code shows it under
   * the call while it runs (`readCommandTail`); absent while no command
   * runs, or when the screen shows none of its output.
   */
  tail?: ChatCommandTail;
}

/**
 * The last lines a running command printed, read off the screen: the
 * transcript has none of its output until the result lands.
 */
export interface ChatCommandTail {
  /** The command as the call's header shows it, cut where Claude Code cut it; none when it could not be read. */
  command: string | null;
  /** Its last lines, oldest first, as wide as the screen drew them; empty before it printed anything. */
  lines: string[];
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
 * the way a narrow screen wrapped it. A shell call running above the
 * spinner brings what it last printed (`tail`).
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
    const activity: ChatActivity = { verb: verb.trim(), detail: detail === '' ? null : detail };
    const tail = readCommandTail(rows.slice(0, index));
    return tail ? { ...activity, tail } : activity;
  }
  return null;
}

/**
 * How Claude Code draws a shell call in flight (2.1.331, its inline
 * renderer, seen in tmux): the tool and its command on a header row, then
 * the output's last lines hung from `⎿`, each further row indented five,
 * then the row that says it is still running: the lines above the tail and
 * the clock ("… +17 lines (21s)"), the clock alone ("(3s)"), the background
 * hint, or "Running…" before any output. A call that finished ends on
 * "(ctrl+o to expand)" or on its last line, with no clock. Its fullscreen
 * renderer shows only "$ <command> (8s · 9 lines)" under a "Running …"
 * header, no output, so nothing is read there.
 */
const SHELL_HEADER = /^\s*(?:[●⏺]\s*)?(?:Bash|PowerShell)\((.*)$/u;
const TAIL_FIRST = /^\s*⎿[ \u00a0]{1,2}(.*)$/u;
const TAIL_NEXT = /^ {5}(.*)$/;
const STILL_RUNNING = [
  /^\s*(?:… \+\d+ lines? )?\(\d+(?:\.\d+)?[hms]\b[^)]*\)/u,
  /^\s*\((?:ctrl|alt|cmd|meta|shift)\+\S+(?: \S+)* (?:to )?run in background\)\s*$/i,
];
const RUNNING_WORD = /^Running…/u;
/** How far under its header a call's `⎿` row may start: a long command wraps onto a second row. */
const HEADER_ROWS = 3;
/** The lines the chat shows, and the characters they may hold together. */
const TAIL_LINES = 3;
const TAIL_CHARS = 600;

/**
 * The output of the shell call in flight, off the rows above the spinner;
 * none when no call there is still running, or the screen shows no output
 * for it. The lowest call that is still running wins: a finished call's
 * lines above it are history.
 */
export function readCommandTail(rows: readonly string[]): ChatCommandTail | null {
  for (let index = rows.length - 1; index >= 0; index--) {
    const header = SHELL_HEADER.exec(rows[index] ?? '');
    if (!header) continue;
    const tail = tailUnder(rows, index + 1);
    if (tail === undefined) continue;
    const command =
      header[1]
        ?.replace(/\)\s*$/, '')
        .replace(/…$/u, '')
        .trim() ?? '';
    return { command: command === '' ? null : command, lines: tail };
  }
  return null;
}

/**
 * The lines under a call's header while it runs, its output's last lines
 * (none yet before it printed anything); `undefined` when it is not a call
 * in flight.
 */
function tailUnder(rows: readonly string[], from: number): string[] | undefined {
  let at = from;
  while (at < rows.length && at < from + HEADER_ROWS && !TAIL_FIRST.test(rows[at] ?? '')) at++;
  const first = TAIL_FIRST.exec(rows[at] ?? '');
  if (!first) return undefined;
  const lines = [first[1] ?? ''];
  for (at += 1; at < rows.length; at++) {
    const next = TAIL_NEXT.exec(rows[at] ?? '');
    if (!next) break;
    lines.push(next[1] ?? '');
  }
  const end = lines.findIndex((line) => STILL_RUNNING.some((running) => running.test(line)));
  if (end < 0) return lines.length === 1 && RUNNING_WORD.test(lines[0] ?? '') ? [] : undefined;
  return clip(
    lines
      .slice(0, end)
      .map((line) => line.trimEnd())
      .filter((line) => line.trim() !== '' && !RUNNING_WORD.test(line)),
  );
}

/** The last lines, and of them no more than the characters the chat holds, cut at the front. */
function clip(lines: string[]): string[] {
  const last = lines.slice(-TAIL_LINES);
  let room = TAIL_CHARS;
  const kept: string[] = [];
  for (let index = last.length - 1; index >= 0 && room > 0; index--) {
    const chars = Array.from(last[index] ?? '');
    kept.unshift(chars.length > room ? `…${chars.slice(-room + 1).join('')}` : chars.join(''));
    room -= chars.length;
  }
  return kept;
}

/** Whether two readings say the same, so an unchanged screen publishes nothing. */
export function sameActivity(a: ChatActivity | null, b: ChatActivity | null): boolean {
  return (
    a === b ||
    (a !== null &&
      b !== null &&
      a.verb === b.verb &&
      a.detail === b.detail &&
      sameTail(a.tail, b.tail))
  );
}

function sameTail(a: ChatCommandTail | undefined, b: ChatCommandTail | undefined): boolean {
  if (a === undefined || b === undefined) return a === b;
  return (
    a.command === b.command &&
    a.lines.length === b.lines.length &&
    a.lines.every((line, index) => line === b.lines[index])
  );
}
