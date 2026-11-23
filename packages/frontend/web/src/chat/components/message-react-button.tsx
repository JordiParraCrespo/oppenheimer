import {
  ChatReactionBar,
  IconButton,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@oppenheimer/design-system-web';
import { SmilePlus } from '@oppenheimer/design-system-web/icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { QUICK_REACTIONS } from '../lib/emoji-catalog';
import { EmojiPicker } from './emoji-picker';

/**
 * React to a message, from its actions on hover: a pill of the six reactions
 * a tap gives (`ChatReactionBar`), "+" swapping it for the whole picker.
 * Picking the reaction you gave takes it back; any other replaces it. The
 * popover closes on a pick.
 */
export function MessageReactButton({
  selected,
  onReact,
}: {
  /** The reaction you gave; null for none. */
  selected: string | null;
  /** The emoji to set, or null to take yours back. */
  onReact: (emoji: string | null) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [more, setMore] = useState(false);

  function pick(emoji: string) {
    setOpen(false);
    onReact(emoji === selected ? null : emoji);
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setMore(false);
      }}
    >
      <PopoverTrigger
        render={
          <IconButton
            size="xs"
            shape="square"
            aria-label={t('common.chat.emoji.react')}
            title={t('common.chat.emoji.react')}
          />
        }
      >
        <SmilePlus aria-hidden />
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="center"
        sideOffset={8}
        className={
          more
            ? 'w-auto overflow-hidden p-0'
            : 'w-auto rounded-full border-none bg-transparent p-0 shadow-none'
        }
      >
        {more ? (
          <EmojiPicker onPick={pick} selected={selected} />
        ) : (
          <ChatReactionBar
            emoji={QUICK_REACTIONS}
            selected={selected}
            onPick={pick}
            onMore={() => setMore(true)}
            labels={{
              react: (emoji) => t('common.chat.emoji.reactWith', { emoji }),
              remove: (emoji) => t('common.chat.emoji.removeReaction', { emoji }),
              more: t('common.chat.emoji.more'),
            }}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}
