import { useStoredFold } from '@oppenheimer/frontend-web';
import type { BotSection } from '@oppenheimer/shared/schemas/bot';

/** The sections whose Bots heading the reader folded, kept on this device. */
const FOLDED_BOTS_KEY = 'oppenheimer.sidebar.bots-folded';

/** Whether `section`'s Bots heading is open, and the toggle that folds it. */
export function useFoldedBots(section: BotSection) {
  return useStoredFold(FOLDED_BOTS_KEY, section);
}
