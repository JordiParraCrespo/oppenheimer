/**
 * How `search_chat` shows a hit (`25-bots.md` §4.1): a window of the
 * message around the first word of the search it contains, cut on both
 * sides with the cut said, so a long message costs a line and not a page.
 */

/** The most hits one search returns. */
export const BOT_CHAT_SEARCH_LIMIT_MAX = 20;

/** The longest window of one message a hit shows. */
export const BOT_CHAT_SNIPPET_MAX = 320;

/**
 * The words of a search as the person or the bot typed it, without the
 * web-search syntax around them (quotes, a leading `-`, `OR`), lower-cased:
 * what to look for in a message to centre its snippet on.
 */
export function searchWords(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.replace(/^[-"]+|"+$/g, ''))
    .filter((word) => word.length > 0 && word !== 'or');
}

/**
 * `content` cut to `max` characters around the first of `words` it holds
 * (its start when it holds none of them as typed: the search matched a
 * form the database folded), with `…` where a cut was made.
 */
export function snippetAround(
  content: string,
  words: readonly string[],
  max = BOT_CHAT_SNIPPET_MAX,
): string {
  const flat = content.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  const lower = flat.toLowerCase();
  const hits = words.map((word) => lower.indexOf(word)).filter((at) => at >= 0);
  const at = hits.length ? Math.min(...hits) : 0;
  const start = Math.max(0, Math.min(at - Math.floor(max / 3), flat.length - max));
  const end = start + max;
  return `${start > 0 ? '…' : ''}${flat.slice(start, end)}${end < flat.length ? '…' : ''}`;
}
