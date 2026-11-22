/** The most emoji a `:` menu lists at once. */
const EMOJI_MENU_MAX = 8;

/** One row of a composer's `:` menu: the emoji, its shortcode and the words it also answers to. */
export interface EmojiRow {
  id: string;
  emoji: string;
  name: string;
  tags: readonly string[];
}

/**
 * A shortcode being typed just before the caret: a `:` that starts the text
 * or follows a space or an opening bracket, then at least two of a
 * shortcode's characters (`:ha` in `so :ha`). The colon in `10:30` or
 * `http://` follows a character, so it opens nothing.
 */
const TYPED_SHORTCODE = /(?:^|[\s([{])(:([a-z0-9_+-]{2,}))$/i;

/**
 * What the person is typing after `:` at `caret` in `text`, and where its
 * colon is; null while the caret is not at the end of a shortcode being typed.
 */
export function emojiQuery(
  text: string,
  caret: number | null,
): { query: string; start: number } | null {
  if (caret === null || caret > text.length) return null;
  const match = TYPED_SHORTCODE.exec(text.slice(0, caret));
  if (!match?.[1] || !match[2]) return null;
  return { query: match[2].toLowerCase(), start: caret - match[1].length };
}

/**
 * The emoji for what is typed, best first: a shortcode that starts with it,
 * then one that contains it, then one whose tag starts with it (`:hap`
 * finds 😀 by its tag `happy`), at most a menu's worth.
 */
export function matchingEmoji(rows: readonly EmojiRow[], query: string): EmojiRow[] {
  const ranked: EmojiRow[][] = [[], [], []];
  for (const row of rows) {
    if (row.name.startsWith(query)) ranked[0]?.push(row);
    else if (row.name.includes(query)) ranked[1]?.push(row);
    else if (row.tags.some((tag) => tag.startsWith(query))) ranked[2]?.push(row);
  }
  return ranked.flat().slice(0, EMOJI_MENU_MAX);
}

/**
 * The text once an emoji is picked: the `:shortcode` before the caret gives
 * way to the emoji and a space (none when a space already follows), and the
 * caret lands after them.
 */
export function insertEmoji(
  text: string,
  at: { start: number; caret: number },
  emoji: string,
): { text: string; caret: number } {
  const after = text.slice(at.caret);
  const inserted = /^\s/.test(after) ? emoji : `${emoji} `;
  return {
    text: `${text.slice(0, at.start)}${inserted}${after}`,
    caret: at.start + inserted.length,
  };
}

let loading: Promise<EmojiRow[]> | null = null;

/**
 * Every emoji with its GitHub shortcodes, read once and on demand: the list is
 * its own chunk, fetched the first time a `:` menu would open, never on the
 * console's first load. A shortcode an emoji has besides its first is its own row.
 */
export function loadEmoji(): Promise<EmojiRow[]> {
  loading ??= import('gemoji').then(({ gemoji }) =>
    gemoji.flatMap((entry) =>
      entry.names.map((name) => ({ id: name, emoji: entry.emoji, name, tags: entry.tags })),
    ),
  );
  // A failed fetch (a deploy that replaced the chunk) is tried again on the next `:`.
  loading.catch(() => {
    loading = null;
  });
  return loading;
}
