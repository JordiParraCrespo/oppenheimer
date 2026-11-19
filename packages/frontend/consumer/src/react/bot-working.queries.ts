'use client';

import { useQuery } from '@oppenheimer/frontend-core/react';
import { botsKeys } from './bots.keys';
import { useConsumerApp } from './context';
import { usePollWhile } from './live-poll';

/**
 * Which bots are at work: a turn of theirs queued or running, whatever
 * started it. One read for the whole sidebar, which `botTurn.changed` keeps
 * current and which polls as `botsWorking` while the workspace stream does
 * not cover it.
 */
function useWorkingBotsSelect<T>(select: (botIds: string[]) => T, fallback: T): T {
  const app = useConsumerApp();
  const queryKey = botsKeys.working();
  const poll = usePollWhile('botsWorking', queryKey, true);
  const { data } = useQuery({
    queryKey,
    queryFn: () => app.bots.findWorkingBotIds(),
    select,
    ...poll,
  });
  return data ?? fallback;
}

/** Whether the bot is working (the sidebar's shimmering name and green dot). */
export function useBotWorking(id: string): boolean {
  return useWorkingBotsSelect((botIds) => botIds.includes(id), false);
}
