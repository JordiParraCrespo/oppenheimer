'use client';

import { useQuery } from '@oppenheimer/frontend-core/react';
import type { BotLoop } from '@oppenheimer/shared/schemas/bot';
import { botsKeys } from './bots.keys';
import { useConsumerApp } from './context';
import { mutation } from './mutation';

/**
 * A bot's loop (`product/versions/mvp/25-bots.md` §4.1, `/loop`): the prompt
 * it runs again and again, and the owner's Stop. The chat reads it again
 * whenever its stream moves.
 */

/**
 * The loop set with `/loop`; `null` when it has none. It draws nothing while
 * it loads, so it is not a Suspense read: the chat is whole without it.
 */
export function useBotLoop(id: string) {
  const app = useConsumerApp();
  return useQuery<BotLoop | null, Error>({
    queryKey: botsKeys.loop(id),
    queryFn: () => app.bots.findLoop(id),
  });
}

export const useClearBotLoop = mutation<void, { id: string }>({
  run: (app, { id }) => app.bots.clearLoop(id),
  update: (queryClient, _data, { id }) =>
    Promise.all([
      queryClient.setQueryData(botsKeys.loop(id), null),
      queryClient.invalidateQueries({ queryKey: botsKeys.conversation(id) }),
    ]),
});
