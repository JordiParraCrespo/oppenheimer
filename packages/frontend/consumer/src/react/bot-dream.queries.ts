'use client';

import { useQuery } from '@oppenheimer/frontend-core/react';
import type { BotMemoryDream } from '@oppenheimer/shared/schemas/bot';
import { useQueryClient } from '@tanstack/react-query';
import { botsKeys } from './bots.keys';
import { useConsumerApp } from './context';
import { mutation } from './mutation';

/**
 * A bot's dreams of its memory (`product/versions/mvp/25-bots.md` §4.1,
 * "Dreaming"): its latest, "Tidy now", and Undo. A dream runs in the
 * background and says so in the chat, whose stream reads the memory again.
 */

/** How often a requested dream is asked after until it lands, and for how long at most. */
const DREAM_POLL_MS = 5_000;
const DREAM_POLL_FOR_MS = 3 * 60_000;

/**
 * The latest dream; `null` before the first. Not a Suspense read: Memory is
 * whole without it. After a Tidy now sent at `requestedAt`, it is read again
 * every few seconds until a dream newer than that lands, for a few minutes at
 * most (a dream with nothing to tidy writes none); a read that finds a newer
 * dream reads the facts again, which it rewrote.
 */
export function useBotMemoryDream(id: string, requestedAt?: number) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  return useQuery<BotMemoryDream | null, Error>({
    queryKey: botsKeys.memoryDream(id),
    queryFn: async () => {
      const before = queryClient.getQueryData<BotMemoryDream | null>(botsKeys.memoryDream(id));
      const latest = await app.bots.findDream(id);
      if (before !== undefined && latest?.id !== before?.id) {
        await queryClient.invalidateQueries({ queryKey: botsKeys.memoryList(id) });
      }
      return latest;
    },
    refetchInterval: (query) => {
      if (requestedAt === undefined || Date.now() - requestedAt > DREAM_POLL_FOR_MS) return false;
      const latest = query.state.data;
      return latest && Date.parse(latest.createdAt) >= requestedAt ? false : DREAM_POLL_MS;
    },
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
