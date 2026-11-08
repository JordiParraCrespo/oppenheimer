import { SettingsTitle } from '@oppenheimer/design-system-web';
import { QueryState } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { TelegramAccountsSkeleton } from '@/features/telegram/components/telegram-accounts-skeleton';
import { TelegramAccounts } from '@/features/telegram/sections/telegram-accounts';

/**
 * Settings → Telegram (`product/next-steps/telegram.md` §2): the reader's own
 * Telegram bots, each made with @BotFather and polled by the runner on one of
 * their hosts, whose chats their Oppenheimer bots read and answer.
 */
export function TelegramSettingsScreen() {
  const { t } = useTranslation();
  return (
    <>
      <SettingsTitle
        title={t('settings.telegram.title')}
        description={t('settings.telegram.description')}
      />
      <QueryState>
        <QueryState.Pending>
          <TelegramAccountsSkeleton />
        </QueryState.Pending>
        <QueryState.Error fallback={t('settings.telegram.loadFailed')} />
        <QueryState.Data>
          <TelegramAccounts />
        </QueryState.Data>
      </QueryState>
    </>
  );
}
