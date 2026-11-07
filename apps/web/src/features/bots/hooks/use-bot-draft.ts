import { useStoredText } from '@oppenheimer/frontend-web';
import { botDrafts, setBotDraft } from '@/features/bots/lib/bot-drafts';

/**
 * A bot's draft and its setter, for the composer: the field re-renders when
 * this bot's draft changes, whoever wrote it (a keystroke, a suggestion).
 */
export function useBotDraft(botId: string): [string, (text: string) => void] {
  const draft = useStoredText(botDrafts, botId);
  return [draft, (text: string) => setBotDraft(botId, text)];
}
