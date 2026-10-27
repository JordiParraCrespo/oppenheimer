/**
 * The projects the reader hid from the sidebar, kept on this device like the
 * folds (`folded-groups.ts`): their ids. A hidden project's group and its
 * sessions are not drawn, unless the project filter picks it or one of its
 * sessions is pinned. Hiding is the reader's, so the API never hears of it.
 */
export const HIDDEN_PROJECTS_KEY = 'oppenheimer.sidebar.hidden';

/** `hidden` with `id` hidden, or shown. */
export function withHidden(hidden: readonly string[], id: string, shown: boolean): string[] {
  const rest = hidden.filter((hiddenId) => hiddenId !== id);
  return shown ? rest : [...rest, id];
}
