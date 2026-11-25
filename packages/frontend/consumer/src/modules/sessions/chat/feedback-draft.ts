/** What a key on the card does, for the ones the console names in its own words. */
export type ChatFeedbackActionKind =
  | 'review'
  | 'send'
  | 'dismiss'
  | 'back'
  | 'keep'
  | 'turnOff'
  | 'retry'
  | 'reviewOrDiscard';

/** The card's words for its keys, by what each does. */
const ACTION_KINDS: Readonly<Record<string, ChatFeedbackActionKind>> = {
  review: 'review',
  send: 'send',
  dismiss: 'dismiss',
  back: 'back',
  keep: 'keep',
  'turn off': 'turnOff',
  'review & retry': 'retry',
  'review or discard': 'reviewOrDiscard',
};

/** The keys that open Claude Code's review of the draft, an editor only its terminal draws. */
const OPENS_TERMINAL: ReadonlySet<ChatFeedbackActionKind> = new Set([
  'review',
  'retry',
  'reviewOrDiscard',
]);

/**
 * A key the card over Claude Code's input box takes: the word it prints
 * after the key, what that word does (none for one the console does not
 * know, which is shown as the card says it), what to type for it, and
 * whether it opens an editor only the terminal draws.
 */
export interface ChatFeedbackAction {
  action: string;
  kind: ChatFeedbackActionKind | null;
  key: string;
  opensTerminal: boolean;
}

function actionOf(word: string, key: string): ChatFeedbackAction {
  const kind = Object.hasOwn(ACTION_KINDS, word) ? (ACTION_KINDS[word] ?? null) : null;
  return { action: word, kind, key, opensTerminal: kind !== null && OPENS_TERMINAL.has(kind) };
}

/**
 * The feedback report the agent drafted and Claude Code holds for the person
 * (its `SendFeedback` tool queues it; nothing is sent until the person says
 * so), as the card over its input box shows it. The transcript has only the
 * tool call; what to do with the draft is answered on that card, by a key,
 * so the chat reads it off the screen and types the key the person picks.
 */
export interface ChatFeedbackDraft {
  /** Its kind and the draft's title ("Bug report", "Took write actions…"); none while the card asks something of its own. */
  kind: string | null;
  title: string | null;
  /** The first lines of the report, as the card previews them. */
  details: string[];
  /**
   * What the card says over its keys: a question ("Send without reviewing
   * (full draft + env, no transcript)?"), where a send stands ("Sending…",
   * "Sent"), or why it failed.
   */
  note: string | null;
  /** The keys it takes now, in its order; none while its prompt holds text. */
  actions: ChatFeedbackAction[];
  /**
   * The terminal's prompt holds text, so the card names no keys: a digit
   * would be typed into the prompt rather than answer it.
   */
  promptHoldsText: boolean;
  /** Drafts queued behind this one. */
  more: number;
}

/** Claude Code's input box's top edge: one line of `─`. */
const RULE = /^\s*─{8,}\s*$/u;
/** The card's head: its glyph, then `<Kind> drafted: <title>`. */
const HEAD = /^(?:[^\p{L}\p{N}\s]\s+)?(.+?) drafted: (.+)$/u;
/** The card's own question when the person dismisses a draft. */
const TURN_OFF = /^(?:[^\p{L}\p{N}\s]\s+)?(Turn off Claude-drafted feedback\?)\s*(.*)$/u;
/** A key the card names (`2`, `Esc`) and the word after it: `2 to send`, `Esc to back`. */
const CHORD = /^(\d|Esc|Escape|Enter) to (.+)$/iu;
/** A line's words before its first key: a question, a send's state, an error. */
const LEAD = /^(.*?)\s*((?:\d|Esc|Escape|Enter) to .+)$/iu;
/** What it prints instead of its keys while its prompt holds text. */
const CLEAR_TEXT = /^clear text to /u;
const MORE = /^\+(\d+) more queued$/u;
/** The rows the card spans, head to hint: the head, six preview rows, the hint, and a border's slack. */
const CARD_ROWS_MAX = 10;
/** The rows between the card and the input box: its bottom margin, and the border some themes draw. */
const GAP_ROWS_MAX = 3;
const SEPARATOR = ' · ';

/** A row without the border a theme draws round the card. */
function clean(row: string): string {
  return row.replace(/^[\s│┃╎]+/u, '').replace(/[\s│┃╎]+$/u, '');
}

/** Whether a row is a border of the card's own, or blank. */
function frame(row: string): boolean {
  return /^[\s─│┃╭╮╰╯]*$/u.test(row) && !RULE.test(row);
}

/** A glyph Claude Code puts before a status (`✓ Sent`, `✗ Couldn't send`), dropped. */
function unmarked(text: string): string {
  return text.replace(/^[^\p{L}\p{N}\s(]\s+/u, '');
}

function keyOf(chord: string): string {
  const name = chord.toLowerCase();
  if (name === 'esc' || name === 'escape') return '\u001b';
  if (name === 'enter') return '\r';
  return chord;
}

interface Hint {
  note: string | null;
  actions: ChatFeedbackAction[];
  more: number;
  /** The prompt holds text, so the card names no keys (`clear text to …`). */
  blocked: boolean;
}

/**
 * A line of the card's keys split into what it says and the keys it names:
 * `1 to review · 2 to send · 0 to dismiss · +2 more queued`,
 * `Send without reviewing (…)? 2 to send · Esc to back`, or `Sent`.
 */
function hintOf(line: string): Hint {
  const actions: ChatFeedbackAction[] = [];
  const words: string[] = [];
  let more = 0;
  let blocked = false;
  for (const [index, part] of line.split(SEPARATOR).entries()) {
    const piece = part.trim();
    const count = MORE.exec(piece);
    if (count) {
      more = Number(count[1]);
      continue;
    }
    if (CLEAR_TEXT.test(piece)) {
      blocked = true;
      continue;
    }
    const lead = index === 0 ? LEAD.exec(piece) : null;
    const chord = CHORD.exec(lead ? (lead[2] ?? '') : piece);
    if (!chord) {
      words.push(piece);
      continue;
    }
    if (lead?.[1]) words.push(lead[1]);
    actions.push(actionOf((chord[2] ?? '').trim(), keyOf(chord[1] ?? '')));
  }
  const note = unmarked(words.join(' ').trim());
  return { note: note || null, actions, more, blocked };
}

/** A row the line of keys breaks after: mid-list (`… 2 to send ·`), or on a key's dangling `to`. */
const BREAKS_MID_HINT = /(?:·|(?:\d|Esc|Escape|Enter) to)$/iu;
/** A row that opens the card's own words over its keys: the send's question, or a failure with a key after it. */
const OPENS_HINT = /^(?:Send without reviewing|[✗✘×]\s.*(?:\d|Esc|Escape|Enter) to )/iu;
/** The most rows a wrapped line of keys takes. */
const HINT_ROWS_MAX = 3;

/**
 * Where the line of keys starts among the card's rows under its head. A pane
 * narrower than the line wraps it, so a row above its last is taken in only
 * when the line plainly goes on from it, never because a row of the report
 * happens to read like a key (`3 to 5 times, then failed.`).
 */
function hintStart(lines: readonly string[]): number {
  const last = lines.length - 1;
  let start = last;
  while (start > 0 && last - start < HINT_ROWS_MAX - 1) {
    const above = lines[start - 1] ?? '';
    if (!BREAKS_MID_HINT.test(above) && !OPENS_HINT.test(above)) break;
    start--;
  }
  return start;
}

/** A send under way, and one done: the two lines the card prints with no key. */
const SEND_STATES: ReadonlySet<string> = new Set(['Sending…', 'Sent']);

/** Whether a line is one the card prints over the input box, rather than any words that end up there. */
function cardSays(hint: Hint): boolean {
  return hint.actions.length > 0 || hint.blocked || SEND_STATES.has(hint.note ?? '');
}

/**
 * The last row of a line that starts at `at` and stands over the input box,
 * taking in the rows a narrow pane wrapped it onto; -1 when the box does not
 * follow it.
 */
function lineEnd(rows: readonly string[], at: number): number {
  for (let end = at; end < rows.length && end < at + HINT_ROWS_MAX; end++) {
    if (boxFollows(rows, end + 1)) return end;
    if (frame(rows[end + 1] ?? '')) return -1;
  }
  return -1;
}

/** Whether the input box's top edge follows `from` across the card's bottom margin. */
function boxFollows(rows: readonly string[], from: number): boolean {
  for (let at = from; at < rows.length && at <= from + GAP_ROWS_MAX; at++) {
    const row = rows[at] ?? '';
    if (RULE.test(row)) return true;
    if (!frame(row)) return false;
  }
  return false;
}

/**
 * The drafted report Claude Code shows over its input box, read off the
 * screen's rows top to bottom; none when it shows none.
 *
 * The card is its head (`✻ Bug report drafted: <title>`), up to six rows of
 * the report, then one line of keys (`1 to review · 2 to send · 0 to
 * dismiss`), standing straight over the input box. Sending asks again on
 * that line (`Send without reviewing …? 2 to send · Esc to back`), then
 * says `Sending…` and `Sent`; dismissing asks whether to turn drafting off,
 * a line of its own with no head. While the prompt holds text the card
 * names no keys (`clear text to …`), since a digit would be typed into it.
 * Only a card the input box follows is read, so a reply that quotes one is
 * never taken for it.
 */
export function readFeedbackDraft(rows: readonly string[]): ChatFeedbackDraft | null {
  for (let at = rows.length - 1; at >= 0; at--) {
    const line = clean(rows[at] ?? '');
    const turnOff = TURN_OFF.exec(line);
    const end = turnOff ? lineEnd(rows, at) : -1;
    if (turnOff && end >= 0) {
      const rest = rows.slice(at + 1, end + 1).map((row) => clean(row));
      const hint = hintOf([turnOff[2] ?? '', ...rest].join(' ').trim());
      return {
        kind: null,
        title: null,
        details: [],
        note: turnOff[1] ?? null,
        actions: hint.blocked ? [] : hint.actions,
        promptHoldsText: hint.blocked,
        more: 0,
      };
    }
    const head = HEAD.exec(line);
    if (!head) continue;
    return cardFrom(rows, at, head[1] ?? '', head[2] ?? '');
  }
  return null;
}

/** The card whose head is row `at`: its preview rows down to the line of keys over the input box. */
function cardFrom(
  rows: readonly string[],
  at: number,
  kind: string,
  title: string,
): ChatFeedbackDraft | null {
  const body: string[] = [];
  for (let row = at + 1; row < rows.length && row <= at + CARD_ROWS_MAX; row++) {
    const raw = rows[row] ?? '';
    if (RULE.test(raw)) return null;
    if (!boxFollows(rows, row + 1)) {
      body.push(raw);
      continue;
    }
    // A pane narrower than the line wraps it onto the rows above its last.
    const lines = [...body, raw].map((line) => clean(line));
    const start = hintStart(lines);
    const hint = hintOf(lines.slice(start).join(' '));
    if (!cardSays(hint)) return null;
    const details = lines
      .slice(0, start)
      .filter((line, index, all) => line !== '' || (index > 0 && index < all.length - 1));
    return {
      kind: kind.trim(),
      title: title.trim(),
      details,
      note: hint.note,
      actions: hint.blocked ? [] : hint.actions,
      promptHoldsText: hint.blocked,
      more: hint.more,
    };
  }
  return null;
}

/** Whether two readings say the same, so an unchanged screen publishes nothing. */
export function sameFeedbackDraft(
  a: ChatFeedbackDraft | null,
  b: ChatFeedbackDraft | null,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.kind === b.kind &&
    a.title === b.title &&
    a.note === b.note &&
    a.more === b.more &&
    a.promptHoldsText === b.promptHoldsText &&
    a.details.join('\n') === b.details.join('\n') &&
    a.actions.map((x) => `${x.key}:${x.action}`).join() ===
      b.actions.map((x) => `${x.key}:${x.action}`).join()
  );
}
