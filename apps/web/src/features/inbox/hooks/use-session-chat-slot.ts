import { createContext, type ReactNode, useContext } from 'react';

/**
 * A session as its own page streams it, for an unattended session's card to
 * open in place: the pane is the sessions feature's, so the inbox's route
 * composes it in (features are islands) and the card reads it from here.
 * Without a provider there is no session to open, and the card offers only
 * its link.
 */
export const SessionChatSlotContext = createContext<((sessionId: string) => ReactNode) | null>(
  null,
);

export function useSessionChatSlot() {
  return useContext(SessionChatSlotContext);
}
