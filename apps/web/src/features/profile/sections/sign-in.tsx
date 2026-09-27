import {
  Button,
  SettingsGroup,
  SettingsHeading,
  SettingsRow,
} from '@oppenheimer/design-system-web';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChangePasswordDialog } from '../dialogs/change-password';

/** Sign-in: the password, changed in a dialog. */
export function SignInSection() {
  const { t } = useTranslation();
  const [changing, setChanging] = useState(false);

  return (
    <section className="flex flex-col gap-3">
      <SettingsHeading>{t('settings.security.heading')}</SettingsHeading>
      <SettingsGroup>
        <SettingsRow
          label={t('settings.security.password')}
          hint={t('settings.security.passwordHint')}
        >
          <Button type="button" variant="secondary" size="sm" onClick={() => setChanging(true)}>
            {t('settings.security.change')}
          </Button>
        </SettingsRow>
      </SettingsGroup>
      {changing ? <ChangePasswordDialog onClose={() => setChanging(false)} /> : null}
    </section>
  );
}
