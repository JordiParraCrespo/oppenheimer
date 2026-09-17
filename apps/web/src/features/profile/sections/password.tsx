import { Alert, AlertDescription, Badge, Switch, toast } from '@oppenheimer/design-system-web';
import { ShieldCheck } from '@oppenheimer/design-system-web/icons';
import type { ProfileEntity } from '@oppenheimer/frontend-consumer';
import { useChangeOwnPassword } from '@oppenheimer/frontend-consumer/react';
import {
  RowControl,
  RowMedia,
  RowMeta,
  SectionCard,
  SectionHead,
  SectionRow,
  useErrorMessage,
} from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { PasswordForm, type PasswordFormValues } from '@/features/profile/forms/password-form';

export function PasswordSection({ profile }: { profile: ProfileEntity }) {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const change = useChangeOwnPassword();

  const onSubmit = async (values: PasswordFormValues) => {
    await change.mutateAsync({
      currentPassword: values.currentPassword,
      newPassword: values.newPassword,
      // The usual reason to change a password is that somebody else may know
      // the old one; leaving their session alive would make this pointless.
      revokeOtherSessions: true,
    });
    toast.success(t('toasts.passwordChanged'));
  };

  return (
    <>
      <SectionHead title={t('profile.password.title')} sub={t('profile.password.description')} />

      {change.error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{resolveError(change.error).message}</AlertDescription>
        </Alert>
      )}

      <PasswordForm isPending={change.isPending} onSubmit={onSubmit} />

      <SectionCard>
        <SectionRow>
          <RowMedia>
            <ShieldCheck className="size-[17px] text-ink-600" />
          </RowMedia>
          <RowMeta
            name={t('profile.password.twoFactor')}
            description={t('profile.password.twoFactorDescription')}
          />
          <RowControl>
            {profile.twoFactorEnabled ? (
              <Badge variant="active">{t('profile.password.twoFactorOn')}</Badge>
            ) : (
              <span className="text-sm text-ink-400">
                {t('profile.password.twoFactorUnavailable')}
              </span>
            )}
            {/* Read-only: this deployment does not run Better Auth's two-factor
                plugin, so there is nothing behind the switch. Shown rather than
                hidden so the row does not appear the day it is enabled and
                surprise anyone. */}
            <Switch
              checked={profile.twoFactorEnabled}
              disabled
              aria-label={t('profile.password.twoFactor')}
            />
          </RowControl>
        </SectionRow>
      </SectionCard>
    </>
  );
}
