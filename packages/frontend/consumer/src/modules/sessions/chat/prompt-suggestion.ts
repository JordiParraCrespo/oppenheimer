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

/**
 * The next message Claude Code predicts the person will send, read off its
 * input box. After most turns it fills the empty box with a suggestion drawn
 * faint, under the cursor, which Tab takes in its own terminal; the
 * transcript never records it, so the terminal reads it there and hands it to
 * the chat. Text the person typed is drawn at full strength, and so is never
 * taken for one.
 *
 * The box is the last row starting `❯` with a rule over and under it. The
 * first cell after the prompt holds the cursor, drawn inverse, so it is not
 * asked to be faint; every other letter is. None while the box is empty, the
 * agent works or asks (no box, or no faint text in it), or the faint text is
 * one of Claude Code's own placeholders (`NOT_A_SUGGESTION`).
 */
export function readPromptSuggestion(rows: readonly ScreenRow[]): string | null {
  for (let index = rows.length - 2; index >= 1; index--) {
    const row = rows[index];
    if (!row || !RULE.test(rows[index - 1]?.text ?? '') || !RULE.test(rows[index + 1]?.text ?? ''))
      continue;
    const match = PROMPT.exec(row.text);
    if (!match) continue;
    const start = (match[1] ?? '').length;
    const text = (match[2] ?? '').trimEnd();
    if (text.trim() === '') return null;
    let letters = 0;
    // The cursor's cell is the first after the prompt: inverse, not faint.
    for (let at = start + 1; at < start + text.length; at++) {
      if (/\s/u.test(row.text[at] ?? ' ')) continue;
      if (!row.faint[at]) return null;
      letters++;
    }
    const suggestion = text.trim();
    return letters > 0 && !NOT_A_SUGGESTION.test(suggestion) ? suggestion : null;
  }
  return null;
}
