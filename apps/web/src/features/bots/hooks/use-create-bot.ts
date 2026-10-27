import { useCreateBot } from '@oppenheimer/frontend-consumer/react';
import type { BotSection } from '@oppenheimer/shared/schemas/bot';
import { useNavigate } from '@tanstack/react-router';
import { botChatDestination } from '@/features/bots/lib/bot-chat-destination';

/**
 * New bot: a blank bot (a first name such as "Juno", no instructions), then
 * its chat, where it asks for its job and writes its own instructions. The sidebar's plus, its empty card
 * and the landing page all start one the same way. From a section's Bots
 * heading (`28-bots-in-sections.md`) the bot shows in that section, and its
 * chat opens where that section opens one (`botChatDestination`).
 */
export function useNewBot(section?: BotSection) {
  const navigate = useNavigate();
  const create = useCreateBot({
    onSuccess: (bot) => {
      const { to, params } = botChatDestination(section, bot.id);
      void navigate({ to, params });
    },
  });
  return {
    create: () => create.mutate(section ? [section] : undefined),
    pending: create.isPending,
    error: create.error,
    reset: () => create.reset(),
  };
}
