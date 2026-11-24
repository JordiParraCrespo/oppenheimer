import { useBots } from '@oppenheimer/frontend-consumer/react';
import { BotTab } from './bot-tab';

/** A bot's tab not on screen, from the bots list: nothing once the bot is gone. */
export function ListedBotTab({ botId, onClose }: { botId: string; onClose: () => void }) {
  const { data: bot } = useBots({ select: (bots) => bots.find((one) => one.id === botId) });
  return bot ? <BotTab bot={bot} active={false} onClose={onClose} /> : null;
}
