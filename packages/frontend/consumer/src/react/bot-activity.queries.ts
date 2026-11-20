'use client';

import { useQuery } from '@oppenheimer/frontend-core/react';
import type { BotActivity } from '../modules/bots/bots.repository';
import { botsKeys } from './bots.keys';
import { useConsumerApp } from './context';
import { usePollWhile } from './live-poll';
import { mutation } from './mutation';

/**
 * What the sidebar shows of the bots: one read for the whole list, which
 * `botTurn.changed` and `botApproval.changed` refetch and which polls as
 * `botActivity`, since a chat read on another device is announced by nothing.
 */
function useBotActivitySelect<T>(select: (activity: BotActivity) => T, fallback: T): T {
  const app = useConsumerApp();
  const queryKey = botsKeys.activity();
  const poll = usePollWhile('botActivity', queryKey, true);
  const { data } = useQuery({
    queryKey,
    queryFn: () => app.bots.findActivity(),
    select,
    ...poll,
  });
  return data ?? fallback;
}

/** Whether the bot is working: a turn of its queued or running (the sidebar's shimmering name). */
export function useBotWorking(id: string): boolean {
  return useBotActivitySelect((activity) => activity.working.includes(id), false);
}

/** Whether the bot waits on you: a card pending, or a turn failed since you read its chat (the amber dot). */
export function useBotWaitingOnYou(id: string): boolean {
  return useBotActivitySelect((activity) => activity.waitingOnYou.includes(id), false);
}

/**
 * The bot's chat read, on every device: its blue dot and a failure's amber
 * one go. The bot and the activity are read again.
 */
export const useAcknowledgeBot = mutation<void, string>({
  run: (app, id) => app.bots.acknowledge(id),
  update: (queryClient, _data, id) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: botsKeys.detail(id) }),
      queryClient.invalidateQueries({ queryKey: botsKeys.lists() }),
      queryClient.invalidateQueries({ queryKey: botsKeys.activity() }),
    ]),
});
