import { ComposerMenu, ComposerMenuItem } from '@oppenheimer/design-system-web';
import { useTranslation } from 'react-i18next';
import type { EmojiRow } from '../lib/emoji-menu';

/**
 * What a `:` can insert, over the composer: each emoji and its `:shortcode:`,
 * the keyboard's place highlighted (`useEmojiMenu`). A click picks one; the
 * pointer press is kept from the field, so the caret stays where it was.
 */
export function ComposerEmojiMenu({
  rows,
  highlighted,
  onPick,
}: {
  rows: readonly EmojiRow[];
  highlighted: number;
  onPick: (row: EmojiRow) => void;
}) {
  const { t } = useTranslation();
  return (
    <ComposerMenu
      aria-label={t('common.chat.emoji.menu')}
      className="absolute inset-x-0 bottom-full z-10 mb-2"
    >
      {rows.map((row, index) => (
        <ComposerMenuItem
          key={row.id}
          icon={<span>{row.emoji}</span>}
          mono
          highlighted={index === highlighted}
          aria-label={t('common.chat.emoji.pick', { emoji: row.emoji, name: row.name })}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onPick(row)}
        >
          :{row.name}:
        </ComposerMenuItem>
      ))}
    </ComposerMenu>
  );
}
