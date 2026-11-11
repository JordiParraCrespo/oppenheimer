import { useStoredBoolean } from '@oppenheimer/frontend-web';

/** Whether the sidebar draws only its pinned sessions, kept on this device. */
export const PINNED_ONLY_KEY = 'oppenheimer.sidebar.pinned-only';

/**
 * Whether the sidebar draws Pinned and no project, and the toggle the filter
 * menu's Pinned only flips. It outlives a reload, like a hidden project.
 */
export function usePinnedOnly() {
  const [pinnedOnly, setPinnedOnly] = useStoredBoolean(PINNED_ONLY_KEY);
  return { pinnedOnly, setPinnedOnly };
}
