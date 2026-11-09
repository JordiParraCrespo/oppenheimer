import { createContext, use, useEffect } from 'react';

/** Counts a placeholder in; the function it returns counts it out. */
export type RegisterPlaceholder = () => () => void;

/** The app's one loading live region (`LoadingAnnouncer`), or none. */
export const LoadingAnnouncerContext = createContext<RegisterPlaceholder | null>(null);

/**
 * Counts a placeholder in the app's `LoadingAnnouncer` while `active`, and
 * says whether one is mounted, so a caller outside it can say "Loading…"
 * itself.
 */
export function useLoadingAnnouncement(active = true): boolean {
  const register = use(LoadingAnnouncerContext);
  // Synchronises with the announcer's live region, which sits outside this subtree.
  useEffect(() => (register && active ? register() : undefined), [register, active]);
  return register !== null;
}
