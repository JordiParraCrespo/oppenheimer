import { SettingsGroup, SettingsHeading } from '@oppenheimer/design-system-web';
import { useSuspenseScheduledMail } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { ScheduledMailRow } from '@/features/mail/sections/scheduled-mail-row';

/**
 * The mail the reader's bots scheduled to send from their Gmail
 * (`product/next-steps/mail.md` §3.4), soonest first, each with Cancel until
 * it goes. Nothing is drawn while none waits. Read under Suspense, in the
 * screen's `QueryState`; a refetch that fails keeps the rows and says so.
 */
export function ScheduledMail() {
  const { t } = useTranslation();
  const { data: rows, error } = useSuspenseScheduledMail();
  if (rows.length === 0 && !error) return null;
  return (
    <div className="mt-8 flex flex-col gap-3">
      <SettingsHeading>{t('settings.mail.scheduledTitle')}</SettingsHeading>
      <ErrorAlert error={error} fallback={t('settings.mail.scheduledLoadFailed')} />
      <SettingsGroup>
        {rows.map((send) => (
          <ScheduledMailRow key={send.id} send={send} />
        ))}
      </SettingsGroup>
    </div>
  );
}
