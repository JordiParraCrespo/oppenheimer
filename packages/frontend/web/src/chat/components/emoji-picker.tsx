import { Input } from '@oppenheimer/design-system-web';
import {
  Apple,
  Clock,
  Flag,
  Heart,
  Lightbulb,
  type LucideIcon,
  PawPrint,
  Plane,
  Search,
  Smile,
  Trophy,
  Users,
} from '@oppenheimer/design-system-web/icons';
import { cn } from '@oppenheimer/design-system-web/utils';
import { type KeyboardEvent, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useStoredList, withListedFirst } from '../../platform';
import { useEmojiCatalog } from '../hooks/use-emoji-catalog';
import {
  EMOJI_GROUPS,
  type EmojiGroupId,
  RECENT_EMOJI_KEY,
  RECENT_EMOJI_MAX,
  searchEmoji,
} from '../lib/emoji-catalog';

/** Each tab's glyph. */
const GROUP_ICON: Record<EmojiGroupId, LucideIcon> = {
  recent: Clock,
  smileys: Smile,
  people: Users,
  nature: PawPrint,
  food: Apple,
  travel: Plane,
  activities: Trophy,
  objects: Lightbulb,
  symbols: Heart,
  flags: Flag,
};

/** How far into the grid a group's heading may sit and still be the tab shown as current. */
const CURRENT_SLACK = 12;

/**
 * Every emoji, to pick one: a row of tabs, one per group, that jumps to it
 * and follows the grid as it scrolls; a search over shortcodes and tags,
 * focused when it opens, Enter picking the first it finds; then the grid,
 * the reader's recently used first (kept on this device). `selected` is
 * marked, so a reaction picker shows the one you gave. A pick is
 * remembered as recent, then handed to `onPick`.
 */
export function EmojiPicker({
  onPick,
  selected,
  className,
}: {
  onPick: (emoji: string) => void;
  selected?: string | null;
  className?: string;
}) {
  const { t } = useTranslation();
  const groups = useEmojiCatalog();
  const [recent, setRecent] = useStoredList(RECENT_EMOJI_KEY);
  const [query, setQuery] = useState('');
  const [current, setCurrent] = useState<EmojiGroupId>(recent.length > 0 ? 'recent' : 'smileys');
  const grid = useRef<HTMLDivElement>(null);
  const found = groups && query.trim() ? searchEmoji(groups, query) : null;
  const sections = groups
    ? [
        ...(recent.length > 0
          ? [{ id: 'recent' as const, emoji: recent.map((emoji) => ({ emoji, name: emoji })) }]
          : []),
        ...groups,
      ]
    : [];

  function pick(emoji: string) {
    setRecent((list) => withListedFirst(list, emoji, true).slice(0, RECENT_EMOJI_MAX));
    onPick(emoji);
  }

  function jumpTo(id: EmojiGroupId) {
    // The grid's headings come back with the search cleared: commit that before looking for one.
    flushSync(() => {
      setQuery('');
      setCurrent(id);
    });
    const box = grid.current;
    const heading = box?.querySelector<HTMLElement>(`[data-emoji-group="${id}"]`);
    if (box && heading) box.scrollTop = heading.offsetTop - box.offsetTop;
  }

  function onScroll() {
    const box = grid.current;
    if (!box || found) return;
    let shown: EmojiGroupId | null = null;
    for (const heading of box.querySelectorAll<HTMLElement>('[data-emoji-group]')) {
      if (heading.offsetTop - box.offsetTop <= box.scrollTop + CURRENT_SLACK) {
        shown = heading.dataset.emojiGroup as EmojiGroupId;
      }
    }
    if (shown && shown !== current) setCurrent(shown);
  }

  function onSearchKey(event: KeyboardEvent<HTMLInputElement>) {
    const first = found?.[0];
    if (event.key === 'Enter' && first) {
      event.preventDefault();
      pick(first.emoji);
    }
  }

  const cell = (emoji: string, name: string) => (
    <button
      key={emoji}
      type="button"
      title={`:${name}:`}
      aria-label={name === emoji ? emoji : `${emoji} ${name.replaceAll('_', ' ')}`}
      aria-pressed={emoji === selected}
      onClick={() => pick(emoji)}
      className={cn(
        'flex size-9.5 items-center justify-center rounded-md text-[24px] leading-none transition-transform duration-fast ease-standard hover:scale-110 hover:bg-hover-surface focus-visible:outline-2 focus-visible:outline-ring',
        emoji === selected && 'bg-selected-surface',
      )}
    >
      {emoji}
    </button>
  );

  return (
    <div data-slot="emoji-picker" className={cn('flex w-88 max-w-full flex-col', className)}>
      <div
        role="tablist"
        aria-label={t('common.chat.emoji.menu')}
        className="flex items-center justify-between border-b border-border-subtle px-1.5"
      >
        {EMOJI_GROUPS.filter((id) => id !== 'recent' || recent.length > 0).map((id) => {
          const Icon = GROUP_ICON[id];
          const label = t(`common.chat.emoji.groups.${id}`);
          const on = !found && current === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={on}
              aria-label={label}
              title={label}
              onClick={() => jumpTo(id)}
              className={cn(
                'relative flex h-10 flex-1 items-center justify-center text-fg-subtle transition-colors duration-fast hover:text-fg focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
                on &&
                  'text-primary after:absolute after:inset-x-1.5 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary',
              )}
            >
              <Icon aria-hidden className="size-4.5" />
            </button>
          );
        })}
      </div>
      <div className="px-3 pt-3 pb-1">
        <Input
          quiet
          pill
          size="sm"
          // The picker opens to search, the way a reaction or a composer's emoji is found.
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onSearchKey}
          placeholder={t('common.chat.emoji.search')}
          aria-label={t('common.chat.emoji.search')}
          leading={<Search aria-hidden className="text-fg-subtle" />}
        />
      </div>
      <div ref={grid} onScroll={onScroll} className="relative h-80 overflow-y-auto px-2 pb-2">
        {!groups ? (
          <div className="grid grid-cols-9 gap-0.5 pt-2" aria-hidden>
            {Array.from({ length: 45 }, (_, index) => (
              <span
                // A placeholder grid: the cells have no identity but their place.
                // biome-ignore lint/suspicious/noArrayIndexKey: placeholders
                key={index}
                className="m-1.5 size-6.5 animate-pulse rounded-full bg-hover-surface"
              />
            ))}
          </div>
        ) : found ? (
          found.length > 0 ? (
            <>
              <h3 className="px-1.5 pt-2 pb-1 text-[12px] font-medium text-fg-subtle">
                {t('common.chat.emoji.results')}
              </h3>
              <div className="grid grid-cols-9 gap-0.5">
                {found.map((entry) => cell(entry.emoji, entry.name))}
              </div>
            </>
          ) : (
            <p className="px-2 py-10 text-center text-sm text-fg-muted">
              {t('common.chat.emoji.noResults')}
            </p>
          )
        ) : (
          sections.map((section) => (
            <section key={section.id} aria-label={t(`common.chat.emoji.groups.${section.id}`)}>
              <h3
                data-emoji-group={section.id}
                className="sticky top-0 z-1 bg-popover px-1.5 pt-2 pb-1 text-[12px] font-medium text-fg-subtle"
              >
                {t(`common.chat.emoji.groups.${section.id}`)}
              </h3>
              <div className="grid grid-cols-9 gap-0.5">
                {section.emoji.map((entry) => cell(entry.emoji, entry.name))}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
