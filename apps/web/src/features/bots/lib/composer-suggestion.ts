import type { KeyboardEvent } from 'react';

/** What the composer is doing, as far as offering a suggestion goes. */
export interface ComposerSuggestionState {
  /** A turn queued or running, a send the API has not answered, or messages waiting. */
  busy: boolean;
  draft: string;
  images: number;
  /** A built-in command's notice on the box's top edge. */
  notice: boolean;
}

/** A suggestion is offered only to an idle bot's empty box, with nothing on its top edge. */
export function offersSuggestion({
  busy,
  draft,
  images,
  notice,
}: ComposerSuggestionState): boolean {
  return !busy && draft === '' && images === 0 && !notice;
}

/** Tab alone, which takes the suggestion; with a modifier it moves focus as ever. */
export function isPlainTab(event: KeyboardEvent<HTMLElement>): boolean {
  return (
    event.key === 'Tab' && !event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey
  );
}
