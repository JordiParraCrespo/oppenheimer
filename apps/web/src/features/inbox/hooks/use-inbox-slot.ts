import { createContext, type ReactNode, useContext } from 'react';

/** What a card opens in place, by the id of what it opens. */
export type InboxSlot = (id: string) => ReactNode;

/**
 * What the Inbox's cards open in place, from the route: a bot's chat for a
 * bot's notice, a session streamed as its own page draws it for a session
 * left unattended. Each is another feature's, so the inbox's route composes
 * them in (features are islands) and the card several levels down reads its
 * own from here. A slot not provided means there is nothing to open, and the
 * card offers only its link.
 */
export interface InboxSlots {
  bot: InboxSlot | null;
  session: InboxSlot | null;
}

export const InboxSlotsContext = createContext<InboxSlots>({ bot: null, session: null });

export function useInboxSlot(name: keyof InboxSlots): InboxSlot | null {
  return useContext(InboxSlotsContext)[name];
}
