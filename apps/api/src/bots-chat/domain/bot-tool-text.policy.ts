/**
 * How a bot's tools write their answers (`25-bots.md` §4): labelled lines
 * with ids inline, times in the sender's zone, and a size a prompt can hold,
 * with every cut saying so.
 */

/** The longest answer one tool call hands the model. */
export const BOT_TOOL_OUTPUT_MAX = 12_000;

/** `text`, cut to `BOT_TOOL_OUTPUT_MAX` with a line saying how much was left out. */
export function fitToolOutput(text: string): string {
  if (text.length <= BOT_TOOL_OUTPUT_MAX) return text;
  const kept = text.slice(0, BOT_TOOL_OUTPUT_MAX);
  return `${kept}\n… ${text.length - kept.length} more characters cut. Ask for less (a filter, a smaller limit).`;
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
