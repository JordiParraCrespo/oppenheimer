import { ChatTabSkeleton } from '@oppenheimer/design-system-web';
import { useBot } from '@oppenheimer/frontend-consumer/react';
import { BotTab } from './bot-tab';

/**
 * The tab of the bot on screen, drawn from the bot the chat reads rather
 * than the list, so it keeps its face and name while the list loads or
 * fails.
 */
export function ShownBotTab({ botId, onClose }: { botId: string; onClose: () => void }) {
  const { data: bot, isPending } = useBot(botId);
  if (bot) return <BotTab bot={bot} active onClose={onClose} />;
  return isPending ? <ChatTabSkeleton active /> : null;
}
