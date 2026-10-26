import { SettingsTitle } from '@oppenheimer/design-system-web';
import { QueryState } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { BotHomeHostSkeleton } from '@/features/bots/components/bot-home-host-skeleton';
import { BotHomeHost } from '@/features/bots/sections/bot-home-host';

/**
 * `/bots/$botId/settings/home-host`: where the bot's coding sessions start
 * when no machine is named. The bot itself always runs in Oppenheimer.
 */
export function BotHomeHostScreen({ botId }: { botId: string }) {
  const { t } = useTranslation();

  return (
    <>
      <SettingsTitle
        title={t('bots.settings.homeHost.title')}
        description={t('bots.settings.homeHost.subtitle')}
      />
      <QueryState>
        <QueryState.Pending>
          <BotHomeHostSkeleton />
        </QueryState.Pending>
        <QueryState.Error fallback={t('bots.settings.homeHost.hostsFailed')} />
        <QueryState.Data>
          <BotHomeHost botId={botId} />
        </QueryState.Data>
      </QueryState>
    </>
  );
}
