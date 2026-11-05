import { useStoredFold } from '@oppenheimer/frontend-web';

/** Whether the reader folded the sidebar's whole Sessions list away, kept on this device. */
export const FOLDED_SESSIONS_KEY = 'oppenheimer.sidebar.sessions-folded';

/** Whether the sidebar's Sessions list is open, and the toggle that folds it under its heading. */
export function useFoldedSessions() {
  return useStoredFold(FOLDED_SESSIONS_KEY, 'sessions');
}
