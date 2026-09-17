import { Button } from '@oppenheimer/design-system-web';
import { Mail, ShieldAlert, ShieldCheck } from '@oppenheimer/design-system-web/icons';
import { useResetPassword } from '@oppenheimer/frontend-core/react';
import {
  AuthBackLink,
  AuthEmailChip,
  AuthIconCircle,
  AuthSubtitle,
  AuthTitle,
  authControlClass,
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
        <Button render={<Link to="/forgot-password" />} className={authControlClass}>
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
        <Button render={<Link to="/login" />} className={authControlClass}>
          {t('auth.resetPassword.continue')}
        </Button>
      </>
    );
  }

  return (
    <>
      <AuthTitle>{t('auth.resetPassword.title')}</AuthTitle>
      <AuthSubtitle>{t('auth.resetPassword.description')}</AuthSubtitle>

      {email && (
        <AuthEmailChip>
          <Mail />
          {email}
        </AuthEmailChip>
      )}

      <ResetPasswordForm
        isPending={isPending}
        error={error}
        onSubmit={(values) =>
          mutate({ token, password: values.password }, { onSuccess: () => setDone(true) })
        }
      />
    </>
  );
}
