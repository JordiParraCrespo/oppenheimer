import { useStoredList } from '@oppenheimer/frontend-web';
import { HIDDEN_BOTS_KEY, withHiddenBot } from '../lib/hidden-bots';

/**
 * The bots hidden from the Employees sidebar, and the toggles that change them.
 * localStorage: a hidden bot stays hidden on the next visit on this device.
 */
export function useHiddenBots() {
  const [hidden, setHidden] = useStoredList(HIDDEN_BOTS_KEY);
  return {
    hidden,
    setShown: (id: string, shown: boolean) =>
      setHidden((current) => withHiddenBot(current, id, shown)),
    showAll: () => setHidden([]),
  };
}
