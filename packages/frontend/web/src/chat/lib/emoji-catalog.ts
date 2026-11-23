/** The picker's groups, in the order its tabs show them; `recent` is the reader's own. */
export const EMOJI_GROUPS = [
  'recent',
  'smileys',
  'people',
  'nature',
  'food',
  'travel',
  'activities',
  'objects',
  'symbols',
  'flags',
] as const;
export type EmojiGroupId = (typeof EMOJI_GROUPS)[number];

/** One emoji as the picker shows it: the character, its first shortcode, the words it answers to. */
export interface EmojiEntry {
  emoji: string;
  name: string;
  /** Every shortcode and tag, lower case: what a search matches. */
  words: readonly string[];
}

export interface EmojiGroup {
  id: Exclude<EmojiGroupId, 'recent'>;
  emoji: readonly EmojiEntry[];
}

/** The catalog's categories, by the group each one fills. */
const GROUP_OF_CATEGORY: Record<string, EmojiGroup['id']> = {
  'Smileys & Emotion': 'smileys',
  'People & Body': 'people',
  'Animals & Nature': 'nature',
  'Food & Drink': 'food',
  'Travel & Places': 'travel',
  Activities: 'activities',
  Objects: 'objects',
  Symbols: 'symbols',
  Flags: 'flags',
};

/**
 * The reactions a tap gives, in their order, before the whole picker:
 * approval, love, laughter, surprise, sadness, thanks.
 */
export const QUICK_REACTIONS: readonly string[] = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

/** How many emoji the picker remembers as recently used. */
export const RECENT_EMOJI_MAX = 24;

/** Where this device keeps the emoji picked last, newest first. */
export const RECENT_EMOJI_KEY = 'oppenheimer.emoji.recent';

/** The most results a search lists: a grid's worth, never the whole catalog. */
const SEARCH_MAX = 64;

let loading: Promise<EmojiGroup[]> | null = null;

/**
 * Every emoji, grouped as the picker's tabs are, read once and on demand: the
 * same chunk the `:` menu reads (`loadEmoji`), fetched the first time a
 * picker opens. A failed fetch reads as an empty catalog and is tried again
 * the next time one opens.
 */
export function loadEmojiCatalog(): Promise<EmojiGroup[]> {
  loading ??= import('gemoji').then(
    ({ gemoji }) => {
      const groups = new Map<EmojiGroup['id'], EmojiEntry[]>();
      for (const entry of gemoji) {
        const id = GROUP_OF_CATEGORY[entry.category];
        if (!id || !entry.names[0]) continue;
        const list = groups.get(id) ?? [];
        list.push({
          emoji: entry.emoji,
          name: entry.names[0],
          words: [...entry.names, ...entry.tags].map((word) => word.toLowerCase()),
        });
        groups.set(id, list);
      }
      return EMOJI_GROUPS.flatMap((id) => {
        if (id === 'recent') return [];
        const emoji = groups.get(id);
        return emoji ? [{ id, emoji }] : [];
      });
    },
    () => {
      loading = null;
      return [];
    },
  );
  return loading;
}

/**
 * The emoji a search finds, best first: a shortcode or tag that starts with
 * what is typed, then one that holds it. Spaces and underscores are one
 * (`thumbs up` finds `thumbs_up`); case is ignored.
 */
export function searchEmoji(groups: readonly EmojiGroup[], query: string): EmojiEntry[] {
  const typed = query.trim().toLowerCase().replace(/\s+/g, '_');
  if (!typed) return [];
  const starts: EmojiEntry[] = [];
  const holds: EmojiEntry[] = [];
  for (const group of groups) {
    for (const entry of group.emoji) {
      if (entry.words.some((word) => word.startsWith(typed))) starts.push(entry);
      else if (entry.words.some((word) => word.includes(typed))) holds.push(entry);
    }
  }
  return [...starts, ...holds].slice(0, SEARCH_MAX);
}
