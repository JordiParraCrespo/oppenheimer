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
 * shell does: Up with the caret at the start of the field writes your last
 * message into it, Up again the one before, Down walks back and, past the
 * newest, gives back the draft you had. Each place keeps what you left in
 * the field there (`stepSentHistory`), so an edit, or a new message written
 * over a recalled one, is still there when you step back to it. A recalled
 * message you have not edited steps on from anywhere; once edited, the arrows
 * move the caret through it and step only from its very start or end.
 * `at` says where the walk is, for the box to caption. `reset` ends the
 * walk, on a send. The composer is keyed by bot, so a walk
 * never outlives its bot.
 */
export function useSentHistory(
  botId: string,
  draft: string,
  setDraft: (next: string) => void,
): {
  onKeyDownCapture: (event: KeyboardEvent<HTMLDivElement>) => void;
  reset: () => void;
  /** Which sent message the field is on, 1 the newest, of how many; null on your own draft. */
  at: { position: number; total: number } | null;
} {
  const texts = useBotSentTexts(botId);
  const [place, setPlace] = useState<SentHistoryPlace | null>(null);

  function onKeyDownCapture(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    if (event.shiftKey || event.altKey || event.metaKey || event.ctrlKey) return;
    if (event.nativeEvent.isComposing) return;
    const field = event.target;
    if (!(field instanceof HTMLTextAreaElement)) return;
    const direction = event.key === 'ArrowUp' ? 'older' : 'newer';
    // Your own draft (`-1`) is never a recalled message: its arrows keep to the caret.
    const recalled = place !== null && place.index >= 0 && place.base === draft;
    if (
      !arrowStepsHistory(field.value, field.selectionStart, field.selectionEnd, direction, recalled)
    ) {
      return;
    }
    const next = stepSentHistory(texts, place, draft, direction);
    if (!next) return;
    event.preventDefault();
    setPlace(next);
    setDraft(next.base);
  }

  const at = place && place.index >= 0 ? { position: place.index + 1, total: texts.length } : null;
  return { onKeyDownCapture, reset: () => setPlace(null), at };
}
