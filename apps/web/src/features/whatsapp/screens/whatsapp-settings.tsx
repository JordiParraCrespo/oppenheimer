import { SettingsTitle } from '@oppenheimer/design-system-web';
import { QueryState } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { WhatsappAccountsSkeleton } from '@/features/whatsapp/components/whatsapp-accounts-skeleton';
import { WhatsappAccounts } from '@/features/whatsapp/sections/whatsapp-accounts';

/**
 * Settings → WhatsApp (`product/next-steps/whatsapp.md` §1): the reader's own
 * numbers, each a WhatsApp linked device held by the runner on one of their
 * hosts, whose chats their bots read and write in.
 */
export function WhatsappSettingsScreen() {
  const { t } = useTranslation();
  return (
    <>
      <SettingsTitle
        title={t('settings.whatsapp.title')}
        description={t('settings.whatsapp.description')}
      />
      <QueryState>
        <QueryState.Pending>
          <WhatsappAccountsSkeleton />
        </QueryState.Pending>
        <QueryState.Error fallback={t('settings.whatsapp.loadFailed')} />
        <QueryState.Data>
          <WhatsappAccounts />
        </QueryState.Data>
      </QueryState>
    </>
  );
}
