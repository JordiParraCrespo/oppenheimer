import { QueryState } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { BotSlackSkeleton } from '@/features/bots/components/bot-slack-skeleton';
import { BotSlack } from '@/features/bots/sections/bot-slack';

/** The bot's own Slack app: what it does, then its setup or its connection. */
export function BotSlackPanel({ botId }: { botId: string }) {
  const { t } = useTranslation();
  return (
    <section data-testid="bot-slack-gateway" className="flex flex-col gap-3">
      <p className="m-0 px-1 text-sm text-fg-muted">{t('bots.settings.slack.subtitle')}</p>
      <QueryState>
        <QueryState.Pending>
          <BotSlackSkeleton />
        </QueryState.Pending>
        <QueryState.Error fallback={t('bots.settings.slack.loadFailed')} />
        <QueryState.Data>
          <BotSlack botId={botId} />
        </QueryState.Data>
      </QueryState>
    </section>
  );
}
