import { useStoredList } from '@oppenheimer/frontend-web';
import { HIDDEN_PROJECTS_KEY, withHidden } from '../lib/hidden-projects';

/**
 * The projects hidden from the sidebar, and the toggles that change them.
 * localStorage: a hidden project stays hidden on the next visit on this device.
 */
export function useHiddenProjects() {
  const [hidden, setHidden] = useStoredList(HIDDEN_PROJECTS_KEY);
  return {
    hidden,
    setShown: (id: string, shown: boolean) =>
      setHidden((current) => withHidden(current, id, shown)),
    showAll: () => setHidden([]),
  };
}
