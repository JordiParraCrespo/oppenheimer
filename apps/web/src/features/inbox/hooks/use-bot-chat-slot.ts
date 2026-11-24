import { createContext, type ReactNode, useContext } from 'react';

/**
 * A bot's chat as the route draws it, for a bot notice to open in place: the
 * chat is the bots feature's, so the inbox's route composes it in (features
 * are islands) and the card several levels down reads it from here. Without
 * a provider there is no chat to open, and the card offers only its link.
 */
export const BotChatSlotContext = createContext<((botId: string) => ReactNode) | null>(null);

export function useBotChatSlot() {
  return useContext(BotChatSlotContext);
}
