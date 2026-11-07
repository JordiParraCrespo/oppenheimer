'use client';

import { useQuery } from '@oppenheimer/frontend-core/react';
import type { BotMemoryDreamState } from '@oppenheimer/shared/schemas/bot';
import { useQueryClient } from '@tanstack/react-query';
import { botsKeys } from './bots.keys';
import { useConsumerApp } from './context';
import { usePollWhile } from './live-poll';
import { mutation } from './mutation';

/**
 * A bot's dreams of its memory (`product/versions/mvp/25-bots.md` §4.1,
 * "Dreaming"): its latest, "Tidy now", and Undo.
 */

/**
 * The latest dream (`null` before the first) and whether one its owner asked
 * for is under way. Not a Suspense read: Memory is whole without it. While one
 * is pending it is read again every few seconds; a read that finds a newer
 * dream reads the facts again, which it rewrote.
 */
export function useBotMemoryDream(id: string) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  const queryKey = botsKeys.memoryDream(id);
  const poll = usePollWhile<BotMemoryDreamState>(
    'memoryDream',
    queryKey,
    (state) => state?.pending === true,
  );
  return useQuery<BotMemoryDreamState, Error>({
    queryKey,
    queryFn: async () => {
      const before = queryClient.getQueryData<BotMemoryDreamState>(queryKey);
      const state = await app.bots.findDream(id);
      if (before && state.latest?.id !== before.latest?.id) {
        await queryClient.invalidateQueries({ queryKey: botsKeys.memoryList(id) });
      }
      return state;
    },
    ...poll,
  });
}

/** Tidy now: the dream is read again, which now says it is under way. */
export const useRequestBotMemoryDream = mutation<void, string>({
  run: (app, id) => app.bots.requestDream(id),
  update: (queryClient, _data, id) =>
    queryClient.invalidateQueries({ queryKey: botsKeys.memoryDream(id) }),
});

/** The facts come back: the memory and the dream are read again, and the chat, which says so. */
export const useUndoBotMemoryDream = mutation<void, string>({
  run: (app, id) => app.bots.undoDream(id),
  update: (queryClient, _data, id) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: botsKeys.memory(id) }),
      queryClient.invalidateQueries({ queryKey: botsKeys.conversation(id) }),
    ]),
});
