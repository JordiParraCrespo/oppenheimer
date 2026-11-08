import type { BotMemoryFactEntity } from '@oppenheimer/frontend-consumer';
import { useBots } from '@oppenheimer/frontend-consumer/react';
import { useTranslation } from 'react-i18next';
import { BotFactRow } from './bot-fact-row';

/**
 * A fact about the person on Settings → Memory: the bot's own row, on the
 * bot that keeps it, with that bot's name. The name is read from the bots
 * list, which the console has read already, so the row waits on nothing.
 */
export function KeptFactRow({ fact }: { fact: BotMemoryFactEntity }) {
  const { t } = useTranslation();
  const { data: name } = useBots({
    select: (bots) => bots.find((bot) => bot.id === fact.botId)?.name,
  });
  return <BotFactRow botId={fact.botId} fact={fact} keptBy={name ?? t('settings.memory.aBot')} />;
}
