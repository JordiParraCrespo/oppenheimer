import { ChatTabSkeleton } from '@oppenheimer/design-system-web';
import { useBots } from '@oppenheimer/frontend-consumer/react';
import { BotTab } from './bot-tab';

/** A bot's tab not on screen, from the bots list: a placeholder while it loads, nothing once the bot is gone. */
export function ListedBotTab({ botId, onClose }: { botId: string; onClose: () => void }) {
  const { data: bot, isPending } = useBots({
    select: (bots) => bots.find((one) => one.id === botId),
  });
  if (bot) return <BotTab bot={bot} active={false} onClose={onClose} />;
  // The list has not answered yet: the tab holds its place.
  return isPending ? <ChatTabSkeleton /> : null;
}
