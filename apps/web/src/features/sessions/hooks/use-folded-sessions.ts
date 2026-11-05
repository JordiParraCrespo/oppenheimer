import { useStoredList, withFold } from '@oppenheimer/frontend-web';
import { FOLDED_SESSIONS_KEY } from '../lib/folded-groups';

const SESSIONS = 'sessions';

/**
 * Whether the sidebar's Sessions list is open, and the toggle that folds it
 * under its heading. localStorage: a fold outlives the page on this device.
 */
export function useFoldedSessions() {
  const [folded, setFolded] = useStoredList(FOLDED_SESSIONS_KEY);
  return {
    open: !folded.includes(SESSIONS),
    setOpen: (open: boolean) => setFolded((current) => withFold(current, SESSIONS, open)),
  };
}
