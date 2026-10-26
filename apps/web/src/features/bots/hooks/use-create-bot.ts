import { useCreateBot } from '@oppenheimer/frontend-consumer/react';
import type { BotSection } from '@oppenheimer/shared/schemas/bot';
import { useNavigate } from '@tanstack/react-router';

/**
 * New bot: a blank bot (a first name such as "Juno", no instructions), then
 * its chat, where it asks for its job and writes its own instructions. The sidebar's plus, its empty card
 * and the landing page all start one the same way. From a section's Bots
 * heading (`28-bots-in-sections.md`) the bot shows in that section, and in
 * Pull requests its chat opens there, beside the section's own list.
 */
export function useNewBot(section?: BotSection) {
  const navigate = useNavigate();
  const create = useCreateBot({
    onSuccess: (bot) =>
      section === 'pulls'
        ? navigate({ to: '/pulls/bots/$botId', params: { botId: bot.id } })
        : navigate({ to: '/bots/$botId', params: { botId: bot.id } }),
  });
  return {
    create: () => create.mutate(section ? [section] : undefined),
    pending: create.isPending,
    error: create.error,
    reset: () => create.reset(),
  };
}
