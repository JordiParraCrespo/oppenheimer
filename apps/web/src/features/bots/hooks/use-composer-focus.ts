import { type RefObject, useEffect, useRef } from 'react';
import { subscribeBotDraftFocus } from '@/features/bots/lib/bot-drafts';

/** Focus in the field with the caret after the last character, so writing carries on. */
function focusAtEnd(field: HTMLTextAreaElement): void {
  field.focus({ preventScroll: true });
  const end = field.value.length;
  field.setSelectionRange(end, end);
}

/**
 * The composer's field takes focus when the chat opens, so you can type at
 * once, and again when a suggestion fills its draft. A pointer-only device
 * (a phone) is left alone on open: focus there raises the keyboard over the
 * chat you came to read.
 */
export function useComposerFocus(botId: string): RefObject<HTMLTextAreaElement | null> {
  const field = useRef<HTMLTextAreaElement>(null);

  // Moves the browser's focus, a DOM state outside React: on open and on a fill request.
  useEffect(() => {
    const box = field.current;
    const coarse = globalThis.matchMedia?.('(pointer: coarse)').matches ?? false;
    if (box && !coarse) focusAtEnd(box);
    return subscribeBotDraftFocus((filled) => {
      // After the fill has rendered, so the caret lands after the new text.
      if (filled === botId) requestAnimationFrame(() => field.current && focusAtEnd(field.current));
    });
  }, [botId]);

  return field;
}
