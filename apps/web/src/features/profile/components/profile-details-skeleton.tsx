import { Button, SettingsGroup, SettingsRow, Skeleton } from '@oppenheimer/design-system-web';
import { LoadingStatus } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/**
 * The profile card before the profile answers: each row's label and hint
 * written, the avatar as a pill at its 38px with Upload beside it, a bar for
 * the email with Change, the name's two fields side by side and the username
 * field, each at the control's height. The buttons are there, disabled.
 */
export function ProfileDetailsSkeleton() {
  const { t } = useTranslation();
  return (
    <SettingsGroup aria-busy>
      <LoadingStatus />
      <SettingsRow label={t('settings.profile.picture')} hint={t('settings.profile.pictureHint')}>
        <Skeleton shape="pill" className="size-9.5" />
        <Button type="button" variant="secondary" size="sm" disabled>
          {t('settings.profile.upload')}
        </Button>
      </SettingsRow>
      <SettingsRow label={t('settings.profile.email')} hint={t('settings.profile.emailHint')}>
        <span className="flex h-5 items-center">
          <Skeleton shape="sm" className="h-3 w-40" />
        </span>
        <Button type="button" variant="secondary" size="sm" disabled>
          {t('settings.profile.change')}
        </Button>
      </SettingsRow>
      <SettingsRow label={t('settings.profile.fullName')} control="field">
        <Skeleton shape="sm" className="h-(--control-h-md)" />
        <Skeleton shape="sm" className="h-(--control-h-md)" />
      </SettingsRow>
      <SettingsRow
        label={t('settings.profile.username')}
        control="field"
        hint={t('settings.profile.usernameHint')}
      >
        <Skeleton shape="sm" className="h-(--control-h-md)" />
      </SettingsRow>
    </SettingsGroup>
  );
}
