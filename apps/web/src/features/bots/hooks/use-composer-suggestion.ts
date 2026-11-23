import { useBotSuggestion } from '@oppenheimer/frontend-consumer/react';
import type { KeyboardEvent, RefObject } from 'react';
import { fillBotDraft } from '@/features/bots/lib/bot-drafts';
import {
  type ComposerSuggestionState,
  isPlainTab,
  offersSuggestion,
} from '@/features/bots/lib/composer-suggestion';

/**
 * The guess at your next message the composer offers once the bot has
 * answered (Claude Code's prompt suggestion): read only while
 * `offersSuggestion` holds, shown where the placeholder is. Tab in the field
 * writes it in, to send as it is or edit first; Tab on the box's buttons, or
 * with a modifier, moves focus as ever. `onKeyDownCapture` answers whether it
 * took the key.
 */
export function useComposerSuggestion(
  botId: string,
  field: RefObject<HTMLTextAreaElement | null>,
  state: ComposerSuggestionState,
): {
  suggestion: string | null;
  onKeyDownCapture: (event: KeyboardEvent<HTMLDivElement>) => boolean;
} {
  const suggestion = useBotSuggestion(botId, offersSuggestion(state));

  function onKeyDownCapture(event: KeyboardEvent<HTMLDivElement>): boolean {
    if (!suggestion || event.target !== field.current || !isPlainTab(event)) return false;
    event.preventDefault();
    fillBotDraft(botId, suggestion);
    return true;
  }

  return { suggestion, onKeyDownCapture };
}
