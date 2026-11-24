import type { KeyboardEvent } from 'react';

/**
 * The tag input's keys: Enter or a comma turns the typed text into a tag,
 * Backspace on an empty box removes the last one.
 */
export function onTagInputKeyDown(
  event: KeyboardEvent<HTMLInputElement>,
  typed: string,
  actions: { add: (tag: string) => void; removeLast: () => void },
) {
  if (event.key === 'Enter' || event.key === ',') {
    event.preventDefault();
    const tag = typed.trim();
    if (tag) actions.add(tag);
    return;
  }
  if (event.key === 'Backspace' && typed === '') actions.removeLast();
}
