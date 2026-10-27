import { FOLDED_GROUPS_KEY, withFold } from '../lib/folded-groups';
import { useStoredList } from './use-stored-list';

/**
 * The project groups folded in the sidebar, and the toggle that changes them.
 * localStorage: a fold outlives the page on this device.
 */
export function useFoldedGroups() {
  const [folded, setFolded] = useStoredList(FOLDED_GROUPS_KEY);
  return {
    folded,
    setOpen: (key: string, open: boolean) => setFolded((current) => withFold(current, key, open)),
  };
}
