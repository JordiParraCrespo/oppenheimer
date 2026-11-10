import { useStoredFold } from '@oppenheimer/frontend-web';

/** Whether the sidebar draws only its pinned sessions, kept on this device. */
export const PINNED_ONLY_KEY = 'oppenheimer.sidebar.pinned-only';

/**
 * Whether the sidebar's project groups are drawn below Pinned, and the toggle
 * the filter menu's Pinned only flips. Stored as the projects' fold, so the
 * choice outlives a reload like a hidden project does.
 */
export function usePinnedOnly() {
  const { open, setOpen } = useStoredFold(PINNED_ONLY_KEY, 'projects');
  return { pinnedOnly: !open, setPinnedOnly: (on: boolean) => setOpen(!on) };
}
