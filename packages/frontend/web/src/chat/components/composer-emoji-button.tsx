import {
  IconButton,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@oppenheimer/design-system-web';
import { Smile } from '@oppenheimer/design-system-web/icons';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { insertAtCaret } from '../lib/emoji-menu';
import { EmojiPicker } from './emoji-picker';

/**
 * A composer's emoji button, for `ChatComposer`'s `emoji` slot: the whole
 * picker (`EmojiPicker`) over the field, each pick put where the caret was,
 * so several can be picked in a row; the picker stays open until it is
 * closed or the reader clicks away. The field is the composer's own
 * textarea, found from the button, so any composer serves without handing
 * its ref down.
 */
export function ComposerEmojiButton({
  draft,
  setDraft,
  disabled = false,
}: {
  draft: string;
  setDraft: (next: string) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const field = () =>
    button.current
      ?.closest('[data-slot="chat-composer"], [data-slot="composer"], [data-slot="composer-pill"]')
      ?.querySelector<HTMLTextAreaElement>('textarea') ?? null;

  function insert(emoji: string) {
    const input = field();
    const at = input
      ? { start: input.selectionStart, end: input.selectionEnd }
      : { start: draft.length, end: draft.length };
    const next = insertAtCaret(draft, at, emoji);
    setDraft(next.text);
    // The field takes the new text on the next frame; the caret goes after the emoji then.
    requestAnimationFrame(() => field()?.setSelectionRange(next.caret, next.caret));
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) requestAnimationFrame(() => field()?.focus());
      }}
    >
      <PopoverTrigger
        render={
          <IconButton
            ref={button}
            shape="pill"
            disabled={disabled}
            aria-label={t('common.chat.emoji.open')}
            title={t('common.chat.emoji.open')}
            className="text-fg-muted hover:text-fg"
          />
        }
      >
        <Smile aria-hidden className="size-4.5" />
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        sideOffset={10}
        className="w-auto overflow-hidden p-0"
      >
        <EmojiPicker onPick={insert} />
      </PopoverContent>
    </Popover>
  );
}
