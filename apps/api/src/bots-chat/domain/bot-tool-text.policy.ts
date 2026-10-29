/**
 * How a bot's tools write their answers (`25-bots.md` §4): labelled lines
 * with ids inline, times in the sender's zone, and a size a prompt can hold,
 * with every cut saying so.
 */

/** The longest answer one tool call hands the model. */
export const BOT_TOOL_OUTPUT_MAX = 12_000;

/** Room kept for the line that says what was cut, so the fitted answer stays within the limit. */
const CUT_LINE_MAX = 160;

/** How much of a cut answer is its start; the rest of the room left is its end. */
const BOT_TOOL_OUTPUT_HEAD = Math.floor(((BOT_TOOL_OUTPUT_MAX - CUT_LINE_MAX) * 2) / 3);

/** How much of a cut answer is its end. */
const BOT_TOOL_OUTPUT_TAIL = BOT_TOOL_OUTPUT_MAX - CUT_LINE_MAX - BOT_TOOL_OUTPUT_HEAD;

/**
 * `text` fitted within `BOT_TOOL_OUTPUT_MAX`: its start and its end, with a line
 * between saying how much of the middle was left out. The end is kept
 * because that is where a session's output says how it went: the error, the
 * failing test, the last line before the prompt.
 */
export function fitToolOutput(text: string): string {
  if (text.length <= BOT_TOOL_OUTPUT_MAX) return text;
  const head = keepWholePairs(text.slice(0, BOT_TOOL_OUTPUT_HEAD), 'end');
  const tail = keepWholePairs(text.slice(text.length - BOT_TOOL_OUTPUT_TAIL), 'start');
  const elided = text.length - head.length - tail.length;
  return `${head}\n… ${elided} characters cut from the middle. Ask for less (a filter, a smaller limit) to see them.\n${tail}`;
}

/** `slice` without a surrogate half at the edge a cut made, so no character is broken in two. */
function keepWholePairs(slice: string, edge: 'start' | 'end'): string {
  if (edge === 'end') return slice.replace(/[\uD800-\uDBFF]$/, '');
  return slice.replace(/^[\uDC00-\uDFFF]/, '');
}

/** "15 Oct 2026, 11:00", in `timeZone`; "never" for no time at all. */
export function formatToolTime(at: Date | string | null | undefined, timeZone: string): string {
  if (!at) return 'never';
  const date = typeof at === 'string' ? new Date(at) : at;
  if (Number.isNaN(date.getTime())) return 'unknown';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
}

/**
 * A list as the model reads it: a heading with the count, one line per item,
 * and a plain sentence when there is nothing, so "none" is never read as
 * "could not tell".
 */
export function formatToolList(
  heading: string,
  lines: readonly string[],
  empty: string,
  more?: { shown: number; total: number; hint: string },
): string {
  if (lines.length === 0) return empty;
  const tail =
    more && more.total > more.shown ? `\n(${more.shown} of ${more.total} shown. ${more.hint})` : '';
  return `${heading} (${lines.length}):\n${lines.map((line) => `- ${line}`).join('\n')}${tail}`;
}

/** `text` cut to `max` characters, the cut said. */
export function cut(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}… (cut)` : text;
}

/**
 * Text from outside (a web page, a pull request, a session's output) fenced
 * in `<tag>…</tag>`, so the prompt's rule that fenced text is data holds.
 * Every opening or closing spelling of the tag inside it (any case, any
 * spacing, `</tag >`, `< /tag>`) is neutralised, so the text cannot close
 * the fence early and write outside it.
 */
export function fenceUntrusted(tag: string, text: string): string {
  const spelling = new RegExp(`<(\\s*/?\\s*${tag})`, 'gi');
  return `<${tag}>\n${text.replace(spelling, '&lt;$1')}\n</${tag}>`;
}
