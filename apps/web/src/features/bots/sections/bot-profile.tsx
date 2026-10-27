import { SettingsGroup, SettingsRow } from '@oppenheimer/design-system-web';
import { useSuspenseBot } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert, formatMediumDate, QueryState, useLocale } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { BotChatHistorySkeleton } from '@/features/bots/components/bot-chat-history-skeleton';
import { BotChatHistory } from './bot-chat-history';
import { BotProfileCard } from './bot-profile-card';
import { BotShowsIn } from './bot-shows-in';

/**
 * Settings → Profile below its title: the card (name, description, colour,
 * sidebar group, saved together), the sections it shows in, when the bot was made, and its chat
 * history, which reads the chat on its own so the card never waits on it.
 */
export function BotProfile({ botId }: { botId: string }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { data: bot, error } = useSuspenseBot(botId);

  return (
    <div className="flex flex-col gap-7">
      <ErrorAlert error={error} fallback={t('bots.settings.loadFailed')} />
      <BotProfileCard bot={bot} />
      <BotShowsIn bot={bot} />
      <SettingsGroup>
        <SettingsRow label={t('bots.settings.profile.created')}>
          <span className="figures font-mono text-fg">
            {formatMediumDate(bot.createdAt, locale)}
          </span>
        </SettingsRow>
      </SettingsGroup>
      <section className="flex flex-col gap-2.5">
        <h2 className="eyebrow m-0 px-1">{t('bots.settings.profile.history')}</h2>
        <QueryState>
          <QueryState.Pending>
            <BotChatHistorySkeleton />
          </QueryState.Pending>
          <QueryState.Error fallback={t('bots.settings.loadFailed')} />
          <QueryState.Data>
            <BotChatHistory botId={botId} botName={bot.name} />
          </QueryState.Data>
        </QueryState>
      </section>
    </div>
  );
}
