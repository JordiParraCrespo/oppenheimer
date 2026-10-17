import { useCreateBot } from '@oppenheimer/frontend-consumer/react';
import { useNavigate } from '@tanstack/react-router';

/**
 * New bot: a blank bot (a first name such as "Juno", no instructions), then
 * its chat, where it asks for its job and writes its own instructions. The sidebar's plus, its empty card
 * and the landing page all start one the same way.
 */
export function useNewBot() {
  const navigate = useNavigate();
  const create = useCreateBot({
    onSuccess: (bot) => navigate({ to: '/bots/$botId', params: { botId: bot.id } }),
  });
  return {
    create: () => create.mutate(),
    pending: create.isPending,
    error: create.error,
    reset: () => create.reset(),
  };
}
