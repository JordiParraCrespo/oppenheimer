import { Button, SettingsGroup, SettingsRow } from '@oppenheimer/design-system-web';
import { useSuspenseBot } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert, formatMediumDate, useLocale } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { BotProfileCard } from './bot-profile-card';

/**
 * Settings → Profile below its title: the card (name, description, colour,
 * sidebar group), when the bot was made, and its chat history. There is no
 * history before the chat (`25-bots.md`, slice 2), so the card says so and
 * Export and Clear history stay off until there is something to export or
 * clear.
 */
export function BotProfile({ botId }: { botId: string }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { data: bot, error } = useSuspenseBot(botId);

  return (
    <div className="flex flex-col gap-7">
      <ErrorAlert error={error} fallback={t('bots.settings.loadFailed')} />
      <BotProfileCard bot={bot} />
      <SettingsGroup>
        <SettingsRow label={t('bots.settings.profile.created')}>
          <span className="figures font-mono text-fg">
            {formatMediumDate(bot.createdAt, locale)}
          </span>
        </SettingsRow>
      </SettingsGroup>
      <section className="flex flex-col gap-2.5">
        <h2 className="eyebrow m-0 px-1">{t('bots.settings.profile.history')}</h2>
        <SettingsGroup>
          <SettingsRow label={t('bots.settings.profile.noMessages')}>
            <Button variant="secondary" size="sm" disabled>
              {t('bots.settings.profile.export')}
            </Button>
            <Button variant="secondary" size="sm" disabled>
              {t('bots.settings.profile.clear')}
            </Button>
          </SettingsRow>
        </SettingsGroup>
      </section>
    </div>
  );
}
