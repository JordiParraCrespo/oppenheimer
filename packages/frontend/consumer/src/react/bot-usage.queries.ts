'use client';

import { useSuspenseQuery } from '@oppenheimer/frontend-core/react';
import type { BotUsage } from '@oppenheimer/shared/schemas/bot';
import { botsKeys } from './bots.keys';
import { useConsumerApp } from './context';

/**
 * What a bot's chat has spent (`product/versions/mvp/25-bots.md` §4.1,
 * `/usage`): its turns by model and its calls outside them. The card is a
 * `QueryState` site, so this is a Suspense read; it sits under the bot's
 * key, so what refreshes the bot refreshes it.
 */
export function useSuspenseBotUsage(id: string) {
  const app = useConsumerApp();
  return useSuspenseQuery<BotUsage, Error>({
    queryKey: botsKeys.usage(id),
    queryFn: () => app.bots.findUsage(id),
  });
}
