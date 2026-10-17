/**
 * Predictive local echo, the model: which keys can be drawn before the host
 * echoes them, what the line looks like once they are, and whether what the
 * host sent back agrees. Mosh's speculative echo, narrowed to the one line the
 * cursor is on. The xterm glue and the overlay that draws a prediction are
 * `typeahead.ts`; this file never touches the DOM.
 *
 * **A prediction is only ever drawn over the grid, never written into it.**
 * The grid stays exactly what the host sent, so a wrong guess costs a frame of
 * the wrong glyphs and nothing else: the overlay is dropped and the host's
 * picture shows through.
 *
 * Three rules keep a guess from being shown where it would be wrong:
 *
 * - **Only line editing is predicted**: a printable character inserted at the
 *   cursor, Backspace, Left and Right. Every other key (Enter, Up, Down, Esc,
 *   Tab, a control chord, a paste) asks the program for something only it
 *   knows, so it drops every prediction and starts a new epoch.
 * - **An epoch is tentative until the host confirms one of its guesses.** A
 *   prompt that does not echo (a password) never confirms, so nothing typed
 *   into it is ever drawn. The cost is that the first key after Enter, Up or
 *   Down waits for the host as it does today; the keys after it do not.
 * - **Anything the host sends that matches no guess drops them all**, as does
 *   a guess the host has not confirmed in time (`expire`).
 */

/** A key, as far as prediction is concerned. */
export type TypeaheadKey =
  | { kind: 'insert'; char: string }
  | { kind: 'backspace' }
  | { kind: 'left' }
  | { kind: 'right' }
  | { kind: 'other' };

/** The grid as the model reads it: viewport rows and columns, 0-based. */
export interface TypeaheadScreen {
  readonly cols: number;
  /**
   * Where the program's cursor is, or `null` when it cannot be told. `row`
   * says where it is expected, when the model already knows the line, so a
   * reader that has to search for it searches that row only.
   */
  cursor(row?: number): { row: number; col: number } | null;
  /** One cell: its glyph (a space when empty) and whether it is not one column wide. */
  cell(row: number, col: number): { char: string; wide: boolean };
}

/** One cell the overlay draws. */
export interface PredictedCell {
  col: number;
  char: string;
  cursor: boolean;
}

/** What the overlay draws: cells on one row, or nothing. */
export interface TypeaheadView {
  row: number;
  cells: PredictedCell[];
}

/** The editable stretch of the cursor's row, relative to `Region.start`. */
interface LineState {
  cells: string[];
  cursor: number;
}

/**
 * The part of the cursor's row a prediction may touch: from where the text
 * the cursor is in begins to just before whatever sits right of the gap after
 * it (a box border, a hint). Text is told apart from layout by a run of two
 * blanks, which a prompt's text rarely has and its padding always does.
 */
interface Region {
  row: number;
  start: number;
  end: number;
}

interface Pending {
  key: TypeaheadKey;
  expected: LineState;
  at: number;
}

const ESC = '\u001b';

/**
 * The keys xterm sends, read for prediction. Left and Right come in both
 * cursor-key modes (`ESC [ D` normal, `ESC O D` application); a single
 * code point one column wide is an insert; DEL is Backspace (xterm's default).
 * A multi-character `data` is a paste or a sequence and is never predicted.
 */
export function classifyTypeaheadKey(data: string): TypeaheadKey {
  if (data === '\u007f') return { kind: 'backspace' };
  if (data === `${ESC}[D` || data === `${ESC}OD`) return { kind: 'left' };
  if (data === `${ESC}[C` || data === `${ESC}OC`) return { kind: 'right' };
  const points = [...data];
  if (points.length === 1 && isNarrowPrintable(points[0] as string)) {
    return { kind: 'insert', char: data };
  }
  return { kind: 'other' };
}

/**
 * Printable and one column wide, conservatively: ASCII, Latin-1 and the
 * scripts before the CJK blocks, without combining marks. A character outside
 * it is sent as typed and simply not predicted.
 */
function isNarrowPrintable(char: string): boolean {
  const code = char.codePointAt(0) ?? 0;
  if (code >= 0x20 && code < 0x7f) return true;
  if (code < 0xa0 || code >= 0x1100) return false;
  return !(code >= 0x300 && code < 0x370);
}

/** An empty cell or one horizontal space of any kind (a space, a no-break space). */
const isBlank = (char: string) => char === '' || /^\p{Zs}$/u.test(char);

/**
 * One glyph that is neither a letter, a digit nor blank: how a prompt ends.
 * Not a list bullet (`-`, `*`, `+`, `•`), which starts the reader's own text
 * far more often than it ends a prompt: taken for one, a recalled `- item`
 * lost its bullet to the prompt and deleting through it bounced.
 */
const isPromptMark = (char: string) =>
  [...char].length === 1 &&
  !isBlank(char) &&
  !/[\p{L}\p{N}]/u.test(char) &&
  !'-*+\u2022'.includes(char);

/**
 * Where the reader's text starts on a row whose run of text begins at
 * `start`: past each prompt mark and the blank after it (`❯ `, `> `, `$ `, a
 * box's `│ `), which are the program's. A Backspace guessed into them deleted
 * the prompt until the host refused and the line sprang back.
 *
 * Read off the row rather than fixed where an epoch's first key landed: Up
 * recalls a line and starts an epoch with the cursor at its end, and a floor
 * there would leave every deletion of the recalled text unpredicted. Text
 * the reader typed that starts with a mark and a blank (`- item`) only goes
 * unpredicted at its start, never drawn wrong.
 */
function skipLeadingPrompt(
  start: number,
  cursor: number,
  char: (col: number) => string,
  blank: (col: number) => boolean,
): number {
  let at = start;
  while (at + 2 <= cursor && isPromptMark(char(at)) && blank(at + 1)) at += 2;
  return afterPromptEnd(at, cursor, char, blank);
}

/** The glyphs a shell or REPL prompt ends on: `$`, `#`, `%`, `>`, `❯`, `›`, `»`, `➜`, `λ`. */
const isPromptEnd = (char: string) => '$#%>❯›»➜λ'.includes(char) && char !== '';

/**
 * Past the last prompt ending and its blank before the cursor. Bash's
 * `user@host:~/dir$ ` has no gap before its `$`, so the prompt and the
 * reader's text are one run, and a Backspace past the text was guessed into
 * the path. Text the reader typed with such a pair in it (`ls > out`) only
 * goes unpredicted before it, never drawn wrong.
 */
function afterPromptEnd(
  start: number,
  cursor: number,
  char: (col: number) => string,
  blank: (col: number) => boolean,
): number {
  for (let at = cursor - 2; at >= start; at -= 1) {
    if (isPromptEnd(char(at)) && blank(at + 1)) return at + 2;
  }
  return start;
}

/** The line after `key`, or `null` when the key's effect cannot be known. */
function apply(state: LineState, key: TypeaheadKey): LineState | null {
  const cells = state.cells;
  const length = contentLength(cells);
  switch (key.kind) {
    case 'insert': {
      // One blank must be left at the end for the cursor to sit on. The
      // cursor may stand past the text (after a prompt's trailing space).
      if (Math.max(length, state.cursor) + 1 >= cells.length) return null;
      const next = [...cells.slice(0, state.cursor), key.char, ...cells.slice(state.cursor)];
      next.length = cells.length;
      return { cells: next, cursor: state.cursor + 1 };
    }
    case 'backspace': {
      // At the start of the text a line editor does nothing, and that is the
      // guess: not knowing would drop the guesses before it, and the letters
      // they had deleted came back until the echo. A program that does
      // something there contradicts it, which drops it like any wrong guess.
      if (state.cursor === 0) return state;
      const next = [...cells.slice(0, state.cursor - 1), ...cells.slice(state.cursor), ' '];
      return { cells: next, cursor: state.cursor - 1 };
    }
    case 'left':
      return state.cursor === 0 ? state : { cells, cursor: state.cursor - 1 };
    case 'right':
      // At the end of the text, Right is the program's (Claude Code takes a
      // suggestion with it), so only a move within the text is predicted.
      return state.cursor >= length ? null : { cells, cursor: state.cursor + 1 };
    default:
      return null;
  }
}

/** Where the text ends: the index after its last non-blank cell. */
function contentLength(cells: readonly string[]): number {
  let end = cells.length;
  while (end > 0 && isBlank(cells[end - 1] as string)) end -= 1;
  return end;
}

function sameState(a: LineState, b: LineState): boolean {
  if (a.cursor !== b.cursor) return false;
  const length = Math.max(a.cells.length, b.cells.length);
  for (let i = 0; i < length; i += 1) {
    const left = a.cells[i] ?? ' ';
    const right = b.cells[i] ?? ' ';
    if (left !== right && !(isBlank(left) && isBlank(right))) return false;
  }
  return true;
}

/**
 * The region around the cursor, or `null` when the row cannot be predicted
 * on: a wide glyph in it (its columns stop matching characters) or no room
 * left after the text.
 */
function regionAt(screen: TypeaheadScreen, row: number, col: number): Region | null {
  const blank = (x: number) => x < 0 || x >= screen.cols || isBlank(screen.cell(row, x).char);
  let runStart = col;
  while (runStart > 0 && !(blank(runStart - 1) && blank(runStart - 2))) runStart -= 1;
  const start = skipLeadingPrompt(runStart, col, (x) => screen.cell(row, x).char, blank);
  let textEnd = col;
  while (textEnd < screen.cols && !(blank(textEnd) && blank(textEnd + 1))) textEnd += 1;
  let end = textEnd;
  while (end < screen.cols && blank(end)) end += 1;
  if (end - textEnd < 2) return null;
  for (let x = start; x < end; x += 1) {
    if (screen.cell(row, x).wide) return null;
  }
  return { row, start, end };
}

function readState(screen: TypeaheadScreen, region: Region): LineState | null {
  const cursor = screen.cursor(region.row);
  if (!cursor || cursor.row !== region.row) return null;
  if (cursor.col < region.start || cursor.col >= region.end) return null;
  const cells: string[] = [];
  for (let x = region.start; x < region.end; x += 1) cells.push(screen.cell(region.row, x).char);
  return { cells, cursor: cursor.col - region.start };
}

export class TypeaheadModel {
  private region: Region | null = null;
  /** The line as the host last drew it. */
  private base: LineState | null = null;
  private pending: Pending[] = [];
  /** Whether the host has confirmed a guess since the last unpredictable key. */
  private confirmed = false;

  constructor(
    private readonly now: () => number = () => performance.now(),
    /** Each confirmed guess, with how long the host took to agree. */
    private readonly onConfirm: (latencyMs: number) => void = () => {},
  ) {}

  /** A key the reader typed, before it is sent. */
  key(key: TypeaheadKey, screen: TypeaheadScreen): void {
    if (key.kind === 'other') {
      this.restart();
      return;
    }
    if (this.pending.length === 0 && !this.capture(screen)) return;
    const from = this.pending.at(-1)?.expected ?? this.base;
    const expected = from ? apply(from, key) : null;
    if (!expected) {
      // The program decides what this key does, so the epoch starts over.
      this.restart();
      return;
    }
    this.pending.push({ key, expected, at: this.now() });
  }

  /** The host's output has been parsed into the grid. */
  reconcile(screen: TypeaheadScreen): void {
    if (this.pending.length === 0 || !this.region || !this.base) return;
    const actual = readState(screen, this.region);
    if (!actual) {
      this.restart();
      return;
    }
    let matched = -1;
    for (let i = this.pending.length - 1; i >= 0; i -= 1) {
      if (sameState((this.pending[i] as Pending).expected, actual)) {
        matched = i;
        break;
      }
    }
    if (matched >= 0) {
      const now = this.now();
      for (const guess of this.pending.slice(0, matched + 1)) this.onConfirm(now - guess.at);
      this.confirmed = true;
      this.rebase(actual, this.pending.slice(matched + 1));
      return;
    }
    // Nothing arrived for this line yet: the output was about something else.
    if (sameState(this.base, actual)) return;
    this.restart();
  }

  /** Drops every guess the host has not confirmed within `timeoutMs`. */
  expire(timeoutMs: number): void {
    const oldest = this.pending[0];
    if (oldest && this.now() - oldest.at > timeoutMs) this.restart();
  }

  /** Whether a guess is waiting on the host. */
  get waiting(): boolean {
    return this.pending.length > 0;
  }

  /** What to draw over the grid, or `null` for nothing. */
  view(): TypeaheadView | null {
    const last = this.pending.at(-1);
    if (!this.confirmed || !last || !this.region || !this.base) return null;
    const { start, row } = this.region;
    const draw = new Set<number>([this.base.cursor, last.expected.cursor]);
    last.expected.cells.forEach((char, i) => {
      const host = this.base?.cells[i] ?? ' ';
      if (char !== host && !(isBlank(char) && isBlank(host))) draw.add(i);
    });
    const cells = [...draw]
      .filter((i) => i >= 0 && i < last.expected.cells.length)
      .sort((a, b) => a - b)
      .map((i) => ({
        col: start + i,
        char: last.expected.cells[i] ?? ' ',
        cursor: i === last.expected.cursor,
      }));
    return { row, cells };
  }

  /** Forgets every guess and starts a new, tentative epoch. */
  restart(): void {
    this.pending = [];
    this.region = null;
    this.base = null;
    this.confirmed = false;
  }

  private capture(screen: TypeaheadScreen): boolean {
    const cursor = screen.cursor();
    const region = cursor ? regionAt(screen, cursor.row, cursor.col) : null;
    const base = region ? readState(screen, region) : null;
    if (!region || !base) {
      this.region = null;
      this.base = null;
      this.confirmed = false;
      return false;
    }
    // A confirmation vouches for the line the host last agreed on, nothing
    // else. If the program redrew anything there since (a new prompt that
    // does not echo, appearing without a key), the epoch is tentative again.
    const previous = this.region;
    const continues =
      previous !== null &&
      this.base !== null &&
      previous.row === region.row &&
      previous.start === region.start &&
      sameState(this.base, base);
    if (!continues) this.confirmed = false;
    this.region = region;
    this.base = base;
    return true;
  }

  /** The host is at `actual`; the guesses still waiting are replayed on it. */
  private rebase(actual: LineState, rest: Pending[]): void {
    this.base = actual;
    const replayed: Pending[] = [];
    let state = actual;
    for (const guess of rest) {
      const next = apply(state, guess.key);
      if (!next) {
        this.pending = [];
        return;
      }
      replayed.push({ ...guess, expected: next });
      state = next;
    }
    this.pending = replayed;
  }
}
