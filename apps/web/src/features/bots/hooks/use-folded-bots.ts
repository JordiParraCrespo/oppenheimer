import { useStoredList } from '@oppenheimer/frontend-web';
import type { BotSection } from '@oppenheimer/shared/schemas/bot';

/** The sections whose Bots heading the reader folded, kept on this device. */
const FOLDED_BOTS_KEY = 'oppenheimer.sidebar.bots-folded';

/**
 * Whether `section`'s Bots heading is open, and the toggle that folds it. A
 * fold is the reader's, per section and per device, so the API never hears
 * of it.
 */
export function useFoldedBots(section: BotSection) {
  const [folded, setFolded] = useStoredList(FOLDED_BOTS_KEY);
  return {
    open: !folded.includes(section),
    setOpen: (open: boolean) =>
      setFolded((current) => {
        const rest = current.filter((key) => key !== section);
        return open ? rest : [...rest, section];
      }),
  };
}
