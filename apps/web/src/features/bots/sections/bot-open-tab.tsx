import { useBots } from '@oppenheimer/frontend-consumer/react';
import { BotTab } from './bot-tab';

/**
 * A bot's chat open as a tab over Sessions, by its id: nothing while the
 * bots are read or once the bot is gone.
 */
export function BotOpenTab({
  botId,
  active,
  onClose,
}: {
  botId: string;
  active: boolean;
  onClose: () => void;
}) {
  const { data: bot } = useBots({ select: (bots) => bots.find((one) => one.id === botId) });
  return bot ? <BotTab bot={bot} active={active} onClose={onClose} /> : null;
}
