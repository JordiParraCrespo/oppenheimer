'use client';

import { useQuery } from '@oppenheimer/frontend-core/react';
import { botsKeys } from './bots.keys';
import { useConsumerApp } from './context';

/**
 * A guess at what you will write the bot next, which the composer offers
 * greyed out until Tab takes it (Claude Code's prompt suggestion); `null`
 * when there is none. Read only while `enabled` (the bot idle, the field
 * empty), again when a turn ends, and dropped when you send. The API keeps
 * one per message of the bot's, so reading it again costs no model call.
 * A failure is no suggestion: the composer works the same without one.
 */
export function useBotSuggestion(id: string, enabled: boolean): string | null {
  const app = useConsumerApp();
  const { data } = useQuery<string | null, Error>({
    queryKey: botsKeys.suggestion(id),
    queryFn: () => app.bots.findSuggestion(id),
    enabled,
    retry: false,
  });
  return enabled ? (data ?? null) : null;
}
