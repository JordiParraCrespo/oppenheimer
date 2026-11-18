import { BotAvatar, SearchList } from '@oppenheimer/design-system-web';
import { useBots } from '@oppenheimer/frontend-consumer/react';
import { useTranslation } from 'react-i18next';

/**
 * The launcher's Bot pane: the workspace's bots in the Employees order,
 * searchable by name and job. Picking one opens its chat beside the session.
 */
export function SideBotPicker({ onPick }: { onPick: (botId: string) => void }) {
  const { t } = useTranslation();
  const { data: options = [] } = useBots({
    select: (bots) =>
      bots.map((bot) => ({
        value: bot.id,
        label: bot.name,
        description: bot.description || undefined,
        leading: <BotAvatar option={{ initials: bot.initials }} size={16} face={bot.face} />,
      })),
  });

  return (
    <SearchList
      aria-label={t('sessions.side.launcher.bots')}
      options={options}
      value={null}
      onPick={(option) => onPick(option.value)}
      searchPlaceholder={t('sessions.side.launcher.searchBots')}
      emptyText={(query) =>
        query ? t('sessions.side.launcher.noMatch', { query }) : t('sessions.side.launcher.noBots')
      }
      rows={10}
    />
  );
}
