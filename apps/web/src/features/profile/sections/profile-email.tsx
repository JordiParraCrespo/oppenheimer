import { Badge, Button, SettingsRow } from '@oppenheimer/design-system-web';
import type { ProfileEntity } from '@oppenheimer/frontend-consumer';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChangeEmailDialog } from '../dialogs/change-email';

/**
 * Email: the address the account signs in with, and Change, which sends a
 * link to the new one rather than switching on the spot.
 */
export function ProfileEmailSection({ profile }: { profile: ProfileEntity }) {
  const { t } = useTranslation();
  const [changing, setChanging] = useState(false);

  return (
    <SettingsRow label={t('settings.profile.email')} hint={t('settings.profile.emailHint')}>
      {profile.emailVerified ? null : (
        <Badge variant="neutral">{t('settings.profile.unverified')}</Badge>
      )}
      <span className="max-w-60 truncate text-fg-muted">{profile.email}</span>
      <Button type="button" variant="secondary" size="sm" onClick={() => setChanging(true)}>
        {t('settings.profile.change')}
      </Button>
      {changing ? (
        <ChangeEmailDialog currentEmail={profile.email} onClose={() => setChanging(false)} />
      ) : null}
    </SettingsRow>
  );
}
