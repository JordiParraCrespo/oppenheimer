import { Button } from '@oppenheimer/design-system-mobile/button';
import { Icon } from '@oppenheimer/design-system-mobile/icon';
import { ShieldAlert, ShieldCheck } from '@oppenheimer/design-system-mobile/icons';
import { Text } from '@oppenheimer/design-system-mobile/text';
import { useErrorMessage, useResetPassword } from '@oppenheimer/frontend-core/react';
import { type Href, Link, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthLayout } from '../components/auth-layout';
import {
  AuthBackLink,
  AuthIconCircle,
  AuthSubtitle,
  AuthTitle,
  authControlClass,
} from '../components/auth-primitives';
import { ResetPasswordForm } from '../forms/reset-password-form';

export interface ResetPasswordScreenProps {
  brandLabel?: string;
  forgotPasswordHref: Href;
  loginHref: Href;
}

export function ResetPasswordScreen({
  brandLabel,
  forgotPasswordHref,
  loginHref,
}: ResetPasswordScreenProps) {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const { token } = useLocalSearchParams<{ token?: string }>();
  const { mutate, isPending, error } = useResetPassword();
  const [done, setDone] = useState(false);

  return (
    <AuthLayout brandLabel={brandLabel} legalNote={t('auth.resetPassword.legal')}>
      {!token ? (
        <>
          <AuthIconCircle>
            <Icon as={ShieldAlert} size={24} className="text-ink-900" />
          </AuthIconCircle>
          <AuthTitle>{t('auth.resetPassword.invalidTitle')}</AuthTitle>
          <AuthSubtitle>{t('auth.resetPassword.invalidMessage')}</AuthSubtitle>
          <Link href={forgotPasswordHref} asChild>
            <Button className={authControlClass}>
              <Text>{t('auth.resetPassword.requestNewLink')}</Text>
            </Button>
          </Link>
          <AuthBackLink href={loginHref} />
        </>
      ) : done ? (
        <>
          <AuthIconCircle>
            <Icon as={ShieldCheck} size={24} className="text-ink-900" />
          </AuthIconCircle>
          <AuthTitle>{t('auth.resetPassword.successTitle')}</AuthTitle>
          <AuthSubtitle>{t('auth.resetPassword.successMessage')}</AuthSubtitle>
          <Link href={loginHref} asChild>
            <Button className={authControlClass}>
              <Text>{t('auth.resetPassword.continue')}</Text>
            </Button>
          </Link>
        </>
      ) : (
        <>
          <AuthTitle>{t('auth.resetPassword.title')}</AuthTitle>
          <AuthSubtitle>{t('auth.resetPassword.description')}</AuthSubtitle>
          <ResetPasswordForm
            isPending={isPending}
            error={error ? resolveError(error, t('auth.resetPassword.error')).message : undefined}
            onSubmit={({ password }) =>
              mutate({ token, password }, { onSuccess: () => setDone(true) })
            }
          />
        </>
      )}
    </AuthLayout>
  );
}
