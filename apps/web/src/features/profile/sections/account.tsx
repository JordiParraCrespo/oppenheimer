import {
  Button,
  SettingsGroup,
  SettingsHeading,
  SettingsRow,
} from '@oppenheimer/design-system-web';
import { useMyProfile } from '@oppenheimer/frontend-consumer/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DeleteAccountDialog } from '../dialogs/delete-account';

/**
 * Account: the one destructive setting, Delete account, in the export's own
 * group. The dialog asks for the email typed out, so the row waits for the
 * profile before it offers the button.
 */
export function AccountSection() {
  const { t } = useTranslation();
  const email = useMyProfile().data?.email;
  const [deleting, setDeleting] = useState(false);

  return (
    <section className="flex flex-col gap-3">
      <SettingsHeading>{t('settings.account.heading')}</SettingsHeading>
      <SettingsGroup>
        <SettingsRow label={t('settings.account.delete')} hint={t('settings.account.deleteHint')}>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={!email}
            onClick={() => setDeleting(true)}
          >
            {t('settings.account.delete')}
          </Button>
        </SettingsRow>
      </SettingsGroup>
      {deleting && email ? (
        <DeleteAccountDialog email={email} onClose={() => setDeleting(false)} />
      ) : null}
    </section>
  );
}
