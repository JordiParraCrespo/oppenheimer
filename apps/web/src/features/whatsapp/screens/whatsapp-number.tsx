import { SettingsTitle } from '@oppenheimer/design-system-web';
import { QueryState } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { WhatsappNumberSkeleton } from '@/features/whatsapp/components/whatsapp-number-skeleton';
import { WhatsappNumber } from '@/features/whatsapp/sections/whatsapp-number';

/**
 * Settings → WhatsApp → one number: who answers on it, the number's default
 * bot first, then each group and person it has seen.
 */
export function WhatsappNumberScreen({ accountId }: { accountId: string }) {
  const { t } = useTranslation();
  return (
    <>
      <SettingsTitle
        title={t('settings.whatsapp.chats.pageTitle')}
        description={t('settings.whatsapp.chats.pageDescription')}
      />
      <QueryState>
        <QueryState.Pending>
          <WhatsappNumberSkeleton />
        </QueryState.Pending>
        <QueryState.Error fallback={t('settings.whatsapp.loadFailed')} />
        <QueryState.Data>
          <WhatsappNumber accountId={accountId} />
        </QueryState.Data>
      </QueryState>
    </>
  );
}
