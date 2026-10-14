import { SettingsTitle, Skeleton } from '@oppenheimer/design-system-web';
import { QueryState } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { BotHomeHost } from '@/features/bots/sections/bot-home-host';

/** `/bots/$botId/settings/runs-on`: the machine the bot works on. */
export function BotRunsOnScreen({ botId }: { botId: string }) {
  const { t } = useTranslation();

  return (
    <>
      <SettingsTitle
        title={t('bots.settings.runsOn.title')}
        description={t('bots.settings.runsOn.subtitle')}
      />
      <QueryState>
        <QueryState.Pending>
          <Skeleton shape="lg" className="h-36 w-full" />
        </QueryState.Pending>
        <QueryState.Error fallback={t('bots.settings.runsOn.hostsFailed')} />
        <QueryState.Data>
          <BotHomeHost botId={botId} />
        </QueryState.Data>
      </QueryState>
    </>
  );
}
