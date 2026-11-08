import { useBotSentTexts } from '@oppenheimer/frontend-consumer/react';
import type { KeyboardEvent } from 'react';
import { useState } from 'react';
import {
  arrowStepsHistory,
  type SentHistoryPlace,
  stepSentHistory,
} from '@/features/bots/lib/sent-history';

/**
 * Up and Down in the composer bring back what you sent before, the way a
 * shell does: Up with the caret on the field's first line writes your last
 * message into it, Up again the one before, Down walks back and, past the
 * newest, gives back the draft you had. Editing a recalled message makes it
 * a draft like any other, so the arrows move the caret through it again. The
 * place belongs to what it put in the field, so a keystroke, a send or a fill
 * ends it with no effect to reset it.
 */
export function useSentHistory(
  botId: string,
  draft: string,
  setDraft: (next: string) => void,
): (event: KeyboardEvent<HTMLDivElement>) => void {
  const texts = useBotSentTexts(botId);
  const [held, setHeld] = useState<(SentHistoryPlace & { shown: string }) | null>(null);
  const place = held && held.shown === draft ? held : null;

  return (event) => {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    if (event.shiftKey || event.altKey || event.metaKey || event.ctrlKey) return;
    if (event.nativeEvent.isComposing) return;
    const field = event.target;
    if (!(field instanceof HTMLTextAreaElement)) return;
    const direction = event.key === 'ArrowUp' ? 'older' : 'newer';
    const recalled = place !== null;
    if (
      !arrowStepsHistory(field.value, field.selectionStart, field.selectionEnd, direction, recalled)
    ) {
      return;
    }
    const step = stepSentHistory(texts, place, draft, direction);
    if (!step) return;
    event.preventDefault();
    setHeld(step.place ? { ...step.place, shown: step.draft } : null);
    setDraft(step.draft);
  };
}
