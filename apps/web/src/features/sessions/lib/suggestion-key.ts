/** The keys of a keydown that matter to taking a suggestion. */
interface Keydown {
  key: string;
  shiftKey: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  defaultPrevented: boolean;
}

/**
 * Whether a key in the composer takes the agent's suggestion: Tab alone, the
 * way it takes it in the agent's terminal, and only when nothing before it
 * (the `/` menu) has already used the key. Shift+Tab and the rest still move
 * focus.
 */
export function takesSuggestion(event: Keydown): boolean {
  return (
    event.key === 'Tab' &&
    !event.defaultPrevented &&
    !event.shiftKey &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.metaKey
  );
}
