import { Button } from '@oppenheimer/design-system-web';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { foldOf } from '@/features/bots/lib/long-message';

/**
 * The words of a message you sent, folded when long (`foldOf`): a pasted log
 * shows its first lines and Show all, which opens the rest in place and
 * becomes Show less. Copy, beside the card, always takes the whole text.
 */
export function BotMessageText({ text }: { text: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const fold = foldOf(text);
  if (!fold) return text;
  return (
    <>
      {open ? text : fold.head}
      <span className="mt-2 flex">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2.5"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? t('bots.chat.fold.showLess') : t('bots.chat.fold.showAll', { count: fold.lines })}
        </Button>
      </span>
    </>
  );
}
