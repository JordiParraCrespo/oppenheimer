import { SettingsListRowSkeleton } from '@oppenheimer/design-system-web';
import type { BotMemoryFactEntity } from '@oppenheimer/frontend-consumer';
import { useBots } from '@oppenheimer/frontend-consumer/react';
import { useTranslation } from 'react-i18next';
import { FactRowActionsSkeleton } from '@/features/bots/components/fact-row-actions-skeleton';
import { BotFactRow } from './bot-fact-row';

/**
 * A fact about the person on Settings → Memory: the bot's own row, on the
 * bot that keeps it, with that bot's name. The name is read from the bots
 * list, which the console has usually read already; until it has, the row
 * draws its placeholder rather than name a bot it does not know.
 */
export function KeptFactRow({ fact }: { fact: BotMemoryFactEntity }) {
  const { t } = useTranslation();
  const { data: name, isPending } = useBots({
    select: (bots) => bots.find((bot) => bot.id === fact.botId)?.name,
  });
  if (isPending) return <SettingsListRowSkeleton actions={<FactRowActionsSkeleton />} />;
  return <BotFactRow botId={fact.botId} fact={fact} keptBy={name ?? t('settings.memory.aBot')} />;
}
