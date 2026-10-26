/**
 * The models the reader starred in the engine picker, kept on this device the
 * way the sidebar's pins are (`session-pins.ts`): the picker's keys
 * (`engineKey`, the agent and the model), in the order they were starred. A
 * favourite is the reader's, not the workspace's, so the API never hears of it.
 */
const MODEL_FAVOURITES_KEY = 'oppenheimer.engine.favourites';

/** Anything unreadable, or storage switched off, is no favourite. */
export function storedModelFavourites(): string[] {
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(MODEL_FAVOURITES_KEY) ?? 'null');
    return Array.isArray(stored)
      ? [...new Set(stored.filter((key): key is string => typeof key === 'string'))]
      : [];
  } catch {
    return [];
  }
}

export function rememberModelFavourites(favourites: readonly string[]) {
  try {
    window.localStorage.setItem(MODEL_FAVOURITES_KEY, JSON.stringify(favourites));
  } catch {
    // Private browsing or a full quota: the stars hold until the page reloads.
  }
}
