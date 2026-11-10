import { useStoredBoolean } from '@oppenheimer/frontend-web';

/**
 * Whether the sidebar draws the sessions hidden by a bot, a script or the
 * reader, and the toggle the filter menu's Show hidden sessions flips. Which
 * sessions are hidden is the API's; whether to look at them is this device's.
 */
export function useShowHidden() {
  const [showHidden, setShowHidden] = useStoredBoolean('oppenheimer.sidebar.show-hidden');
  return { showHidden, setShowHidden };
}
