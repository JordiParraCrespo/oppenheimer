import { Button, SettingsListRow } from '@oppenheimer/design-system-web';
import type { ScheduledMailEntity } from '@oppenheimer/frontend-consumer';
import { useCancelScheduledMail } from '@oppenheimer/frontend-consumer/react';
import { dateFormatter, ErrorAlert, useLocale } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/**
 * One scheduled send: its subject over who it goes to and from which account,
 * when it goes, and Cancel, which stops it for good. The row owns its write.
 */
export function ScheduledMailRow({ send }: { send: ScheduledMailEntity }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const cancel = useCancelScheduledMail();
  const when = dateFormatter(locale, { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <>
      <SettingsListRow
        align="center"
        data-testid="scheduled-mail"
        meta={t('settings.mail.scheduledMeta', {
          to: send.recipients.join(', '),
          email: send.accountEmail,
        })}
        kind={t('settings.mail.scheduledFor', { when: when.format(send.scheduledFor) })}
        actions={
          <Button
            size="sm"
            variant="ghost"
            aria-label={t('settings.mail.cancelScheduledLabel', { subject: send.subject })}
            pending={cancel.isPending}
            pendingLabel={t('settings.mail.cancellingScheduled')}
            onClick={() => cancel.mutate(send.id)}
          >
            {t('settings.mail.cancelScheduled')}
          </Button>
        }
      >
        {send.subject}
      </SettingsListRow>
      <ErrorAlert
        error={cancel.error}
        fallback={t('settings.mail.cancelScheduledFailed')}
        onDismiss={cancel.reset}
      />
    </>
  );
}
