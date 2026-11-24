import type { BotSection } from '@oppenheimer/shared/schemas/bot';
import { useRouterState } from '@tanstack/react-router';
import { botChatDestination } from '../lib/bot-chat-destination';

/**
 * Where a bot's chat opens from `section`'s Bots heading, and whether it is
 * the chat on screen: one decision for its row and for its face, so both
 * light up together.
 */
export function useSectionBotChat(section: BotSection, botId: string) {
  const { to, params, path } = botChatDestination(section, botId);
  const active = useRouterState({ select: (state) => state.location.pathname === path });
  return { to, params, active };
}
