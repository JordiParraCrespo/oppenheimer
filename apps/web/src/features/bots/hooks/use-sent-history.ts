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
 * newest, gives back the draft you had. A recalled message you have not
 * edited steps on from any line; once edited, the arrows move the caret
 * through it again and step only from its first or last line, and the draft
 * you had is still there past the newest. `reset` ends the walk, on a send.
 */
export function useSentHistory(
  botId: string,
  draft: string,
  setDraft: (next: string) => void,
): { onKeyDownCapture: (event: KeyboardEvent<HTMLDivElement>) => void; reset: () => void } {
  const texts = useBotSentTexts(botId);
  const [held, setHeld] = useState<(SentHistoryPlace & { botId: string; shown: string }) | null>(
    null,
  );
  const place = held?.botId === botId ? held : null;

  function onKeyDownCapture(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    if (event.shiftKey || event.altKey || event.metaKey || event.ctrlKey) return;
    if (event.nativeEvent.isComposing) return;
    const field = event.target;
    if (!(field instanceof HTMLTextAreaElement)) return;
    const direction = event.key === 'ArrowUp' ? 'older' : 'newer';
    const recalled = place?.shown === draft;
    if (
      !arrowStepsHistory(field.value, field.selectionStart, field.selectionEnd, direction, recalled)
    ) {
      return;
    }
    const step = stepSentHistory(texts, place, draft, direction);
    if (!step) return;
    event.preventDefault();
    setHeld(step.place ? { ...step.place, botId, shown: step.draft } : null);
    setDraft(step.draft);
  }

  return { onKeyDownCapture, reset: () => setHeld(null) };
}
