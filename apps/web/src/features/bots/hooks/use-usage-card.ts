import { useSyncExternalStore } from 'react';
import { subscribeUsageCards, usageCardOpen } from '@/features/bots/lib/usage-cards';

/** Whether this bot's chat shows the usage card; re-renders only when that bot's card opens or closes. */
export function useUsageCard(botId: string): boolean {
  return useSyncExternalStore(
    (onChange) => subscribeUsageCards((changed) => changed === botId && onChange()),
    () => usageCardOpen(botId),
  );
}
