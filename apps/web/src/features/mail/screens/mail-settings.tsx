import { SettingsTitle } from '@oppenheimer/design-system-web';
import { QueryState } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { GmailAccountsSkeleton } from '@/features/mail/components/gmail-accounts-skeleton';
import { GmailAccounts } from '@/features/mail/sections/gmail-accounts';

/**
 * Settings → Mail (`product/next-steps/mail.md` §1): the reader's own Gmail
 * accounts, which their bots search, read and (later) write from.
 */
export function MailSettingsScreen() {
  const { t } = useTranslation();
  return (
    <>
      <SettingsTitle
        title={t('settings.mail.title')}
        description={t('settings.mail.description')}
      />
      <QueryState>
        <QueryState.Pending>
          <GmailAccountsSkeleton />
        </QueryState.Pending>
        <QueryState.Error fallback={t('settings.mail.loadFailed')} />
        <QueryState.Data>
          <GmailAccounts />
        </QueryState.Data>
      </QueryState>
    </>
  );
}
