/**
 * One row of the screen as the suggestion reader needs it: its text, and for
 * each UTF-16 unit of it whether the terminal draws it faint (dim, or a grey
 * that is neither the foreground nor the background). The terminal knows the
 * styles; this reader only needs the one bit.
 */
export interface ScreenRow {
  text: string;
  faint: readonly boolean[];
}

/** A rule over or under Claude Code's input box: one line of `─`. */
const RULE = /^\s*─{8,}\s*$/u;
/** The box's prompt, `❯` and a space (a no-break one since 2.1), then what is in it. */
const PROMPT = /^(\s*[❯>][\s ])(.*)$/u;

/**
 * What else Claude Code draws faint in its empty box, which Tab does not
 * take: the example it offers before the first message (`Try "…"`) and its
 * hints about messages queued in its terminal.
 */
const NOT_A_SUGGESTION = /^(?:Try "|Press up to )/u;

/** The most rows a suggestion wraps onto in a narrow pane; a box taller than this is not read. */
const BOX_ROWS_MAX = 8;

/**
 * The next message Claude Code predicts the person will send, read off its
 * input box. After most turns it fills the empty box with a suggestion drawn
 * faint, under the cursor, which Tab takes in its own terminal; the
 * transcript never records it, so the terminal reads it there and hands it to
 * the chat. Text the person typed is drawn at full strength, and so is never
 * taken for one.
 *
 * The box is the rows between the lowest pair of rules whose first row
 * starts `❯`; a suggestion too long for the pane wraps onto the rows under
 * it, which are read as its continuation. The first cell after the prompt
 * holds the cursor, drawn inverse, so it is not asked to be faint; every
 * other letter is. None while the box is empty, the agent works or asks (no
 * box, or no faint text in it), or the faint text is one of Claude Code's own
 * placeholders (`NOT_A_SUGGESTION`).
 */
export function readPromptSuggestion(rows: readonly ScreenRow[]): string | null {
  for (let bottom = rows.length - 1; bottom >= 2; bottom--) {
    if (!RULE.test(rows[bottom]?.text ?? '')) continue;
    let top = bottom - 1;
    while (top > 0 && bottom - top <= BOX_ROWS_MAX && !RULE.test(rows[top]?.text ?? '')) top--;
    if (!RULE.test(rows[top]?.text ?? '') || top === bottom - 1) continue;
    const box = rows.slice(top + 1, bottom);
    const match = PROMPT.exec(box[0]?.text ?? '');
    if (!match) continue;
    return suggestionIn(box, (match[1] ?? '').length);
  }
  return null;
}

/** The box's text when every letter of it but the cursor's is faint, else none. */
function suggestionIn(box: readonly ScreenRow[], start: number): string | null {
  const parts: string[] = [];
  let letters = 0;
  for (const [index, row] of box.entries()) {
    const from = index === 0 ? start : 0;
    const part = row.text.slice(from).trim();
    if (part === '') continue;
    // The cursor's cell is the first after the prompt: inverse, not faint.
    for (let at = index === 0 ? from + 1 : from; at < row.text.length; at++) {
      if (/\s/u.test(row.text[at] ?? ' ')) continue;
      if (!row.faint[at]) return null;
      letters++;
    }
    parts.push(part);
  }
  const suggestion = parts.join(' ');
  return letters > 0 && !NOT_A_SUGGESTION.test(suggestion) ? suggestion : null;
}

/**
 * The suggestion the chat offers: what the screen shows, once a turn has
 * finished. Before the first, Claude Code's box holds only its own example,
 * and while a turn runs no prediction is current. The one place that decides
 * what counts, with `NOT_A_SUGGESTION` above.
 */
export function offeredSuggestion(
  last: { working: boolean } | undefined,
  suggestion: string | null,
): string | null {
  return last && !last.working ? suggestion : null;
}
