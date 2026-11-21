import { ComposerMenu, ComposerMenuItem } from '@oppenheimer/design-system-web';
import { useTranslation } from 'react-i18next';
import type { EmojiRow } from '../lib/emoji-menu';

/**
 * What a `:` can insert, a narrow popover over the shortcode being typed: each emoji and its `:shortcode:`,
 * the keyboard's place highlighted (`useEmojiMenu`). A click picks one; the
 * pointer press is kept from the field, so the caret stays where it was.
 */
export function ComposerEmojiMenu({
  rows,
  left,
  highlighted,
  onPick,
}: {
  rows: readonly EmojiRow[];
  /** Pixels from the box's left edge, over the shortcode's colon (`useEmojiMenu`). */
  left: number;
  highlighted: number;
  onPick: (row: EmojiRow) => void;
}) {
  const { t } = useTranslation();
  return (
    <ComposerMenu
      aria-label={t('common.chat.emoji.menu')}
      className="absolute bottom-full z-10 mb-2 w-72"
      // Where the colon is, measured in the field: a value no class can hold.
      style={{ left }}
    >
      {rows.map((row, index) => (
        <ComposerMenuItem
          key={row.id}
          icon={<span className="text-lg leading-none">{row.emoji}</span>}
          className="h-9"
          highlighted={index === highlighted}
          aria-label={t('common.chat.emoji.pick', { emoji: row.emoji, name: row.name })}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onPick(row)}
        >
          <span className="font-normal">:{row.name}:</span>
        </ComposerMenuItem>
      ))}
    </ComposerMenu>
  );
}
