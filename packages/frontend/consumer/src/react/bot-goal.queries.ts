'use client';

import { useQuery } from '@oppenheimer/frontend-core/react';
import type { BotGoal } from '@oppenheimer/shared/schemas/bot';
import { botsKeys } from './bots.keys';
import { useConsumerApp } from './context';
import { mutation } from './mutation';

/**
 * A bot's goal (`product/versions/mvp/25-bots.md` §4.1): what it keeps
 * working toward, a continuation turn at a time, and the owner's Stop. The
 * chat reads it again whenever its stream moves.
 */

/**
 * The goal the bot set itself; `null` when it has none. It draws nothing
 * while it loads, so it is not a Suspense read: the chat is whole without it.
 */
export function useBotGoal(id: string) {
  const app = useConsumerApp();
  return useQuery<BotGoal | null, Error>({
    queryKey: botsKeys.goal(id),
    queryFn: () => app.bots.findGoal(id),
  });
}

export const useClearBotGoal = mutation<void, { id: string }>({
  run: (app, { id }) => app.bots.clearGoal(id),
  update: (queryClient, _data, { id }) =>
    Promise.all([
      queryClient.setQueryData(botsKeys.goal(id), null),
      queryClient.invalidateQueries({ queryKey: botsKeys.conversation(id) }),
    ]),
});
