import { SettingsTitle } from '@oppenheimer/design-system-web';
import { QueryState } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { BotSlackSkeleton } from '@/features/slack/components/bot-slack-skeleton';
import { BotSlack } from '@/features/slack/sections/bot-slack';

/**
 * `/bots/$botId/settings/slack`: the bot's own Slack app, through which its
 * owner asks it with a mention or in its DM, and it answers in the thread.
 */
export function BotSlackScreen({ botId }: { botId: string }) {
  const { t } = useTranslation();
  return (
    <>
      <SettingsTitle
        title={t('bots.settings.slack.title')}
        description={t('bots.settings.slack.subtitle')}
      />
      <QueryState>
        <QueryState.Pending>
          <BotSlackSkeleton />
        </QueryState.Pending>
        <QueryState.Error fallback={t('bots.settings.slack.loadFailed')} />
        <QueryState.Data>
          <BotSlack botId={botId} />
        </QueryState.Data>
      </QueryState>
    </>
  );
}
