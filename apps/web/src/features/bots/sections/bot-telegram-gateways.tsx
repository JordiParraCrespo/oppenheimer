import { SettingsGroup, SettingsListRow } from '@oppenheimer/design-system-web';
import { useSuspenseTelegramSettings } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/**
 * The Telegram bots this bot answers on, one row each; a line says so when
 * it answers on none. Groups and other people on Telegram come later.
 */
export function BotTelegramGateways({ botId }: { botId: string }) {
  const { t } = useTranslation();
  const { accounts, error } = useSuspenseTelegramSettings();
  const mine = accounts.filter((account) => account.answeringBotId === botId);
  if (mine.length === 0) {
    return (
      <p className="m-0 px-1 text-sm text-fg-muted">{t('bots.settings.gateways.noTelegram')}</p>
    );
  }

  return (
    <SettingsGroup>
      <ErrorAlert error={error} fallback={t('bots.settings.gateways.telegramFailed')} />
      {mine.map((account) => (
        <SettingsListRow
          key={account.id}
          align="center"
          data-testid="bot-telegram-gateway"
          meta={t('bots.settings.gateways.telegramMeta')}
        >
          {t('bots.settings.gateways.telegramTitle', {
            name: account.username ? `@${account.username}` : account.label,
          })}
        </SettingsListRow>
      ))}
    </SettingsGroup>
  );
}
