import { SettingsTitle } from '@oppenheimer/design-system-web';
import { QueryState } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { GmailAccountsSkeleton } from '@/features/mail/components/gmail-accounts-skeleton';
import { GmailAccounts } from '@/features/mail/sections/gmail-accounts';
import { ScheduledMail } from '@/features/mail/sections/scheduled-mail';

/**
 * Settings → Mail (`product/next-steps/mail.md` §1): the reader's own Gmail
 * accounts, which their bots search, read and write from, and the mail those
 * bots scheduled, which waits here until it goes (§3.4).
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
      <QueryState>
        <QueryState.Pending>
          {/* The section draws nothing while no mail waits, which is the
              usual answer, so the quieter shape is no shape: a heading and a
              row here would fold away on most loads. */}
          {null}
        </QueryState.Pending>
        <QueryState.Error fallback={t('settings.mail.scheduledLoadFailed')} />
        <QueryState.Data>
          <ScheduledMail />
        </QueryState.Data>
      </QueryState>
    </>
  );
}
