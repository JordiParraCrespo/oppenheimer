import { Button } from '@oppenheimer/design-system-web';
import { ShieldAlert, ShieldCheck } from '@oppenheimer/design-system-web/icons';
import { useResetPassword } from '@oppenheimer/frontend-core/react';
import {
  AuthBackLink,
  AuthIconCircle,
  AuthNote,
  AuthSubtitle,
  AuthTitle,
  useErrorMessage,
} from '@oppenheimer/frontend-web';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ResetPasswordForm } from '@/features/auth/forms/reset-password-form';

export function ResetPasswordScreen({
  token,
  linkError,
  email,
}: {
  token?: string;
  linkError?: string;
  email?: string;
}) {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const { mutate, isPending, error } = useResetPassword();
  const [done, setDone] = useState(false);

  if (!token || linkError) {
    return (
      <>
        <AuthIconCircle>
          <ShieldAlert />
        </AuthIconCircle>
        <AuthTitle>{t('auth.resetPassword.invalidTitle')}</AuthTitle>
        <AuthSubtitle>{t('auth.resetPassword.invalidMessage')}</AuthSubtitle>
        <Button size="lg" block render={<Link to="/forgot-password" />}>
          {t('auth.resetPassword.requestNewLink')}
        </Button>
        <AuthBackLink />
      </>
    );
  }

  if (done) {
    return (
      <>
        <AuthIconCircle>
          <ShieldCheck />
        </AuthIconCircle>
        <AuthTitle>{t('auth.resetPassword.successTitle')}</AuthTitle>
        <AuthSubtitle>{t('auth.resetPassword.successMessage')}</AuthSubtitle>
        <Button size="lg" block render={<Link to="/login" />}>
          {t('auth.resetPassword.continue')}
        </Button>
      </>
    );
  }

  return (
    <>
      <AuthTitle>{t('auth.resetPassword.title')}</AuthTitle>
      <AuthSubtitle>
        {email
          ? t('auth.resetPassword.descriptionFor', { email })
          : t('auth.resetPassword.description')}
      </AuthSubtitle>

      <ResetPasswordForm
        isPending={isPending}
        error={error ? resolveError(error, t('auth.resetPassword.error')).message : undefined}
        onSubmit={(values) =>
          mutate({ token, password: values.password }, { onSuccess: () => setDone(true) })
        }
      />

      <AuthNote>{t('auth.resetPassword.note')}</AuthNote>
    </>
  );
}
