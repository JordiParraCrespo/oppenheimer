'use client';

import { useQuery } from '@oppenheimer/frontend-core/react';
import type { BotMemoryDream } from '@oppenheimer/shared/schemas/bot';
import { botsKeys } from './bots.keys';
import { useConsumerApp } from './context';
import { mutation } from './mutation';

/**
 * A bot's dreams of its memory (`product/versions/mvp/25-bots.md` §4.1,
 * "Dreaming"): its latest, "Tidy now", and Undo. A dream runs in the
 * background and says so in the chat, whose stream reads the memory again.
 */

/** The latest dream; `null` before the first. Not a Suspense read: Memory is whole without it. */
export function useBotMemoryDream(id: string) {
  const app = useConsumerApp();
  return useQuery<BotMemoryDream | null, Error>({
    queryKey: botsKeys.memoryDream(id),
    queryFn: () => app.bots.findDream(id),
  });
}

export const useRequestBotMemoryDream = mutation<void, string>({
  run: (app, id) => app.bots.requestDream(id),
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
