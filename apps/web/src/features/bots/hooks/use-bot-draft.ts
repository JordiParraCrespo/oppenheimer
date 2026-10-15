import { useSyncExternalStore } from 'react';
import { botDraft, setBotDraft, subscribeBotDrafts } from '@/features/bots/lib/bot-drafts';

/**
 * A bot's draft and its setter, for the composer: the field re-renders when
 * this bot's draft changes, whoever wrote it (a keystroke, a suggestion).
 */
export function useBotDraft(botId: string): [string, (text: string) => void] {
  const draft = useSyncExternalStore(
    (onChange) => subscribeBotDrafts((changed) => changed === botId && onChange()),
    () => botDraft(botId),
  );
  return [draft, (text: string) => setBotDraft(botId, text)];
}
