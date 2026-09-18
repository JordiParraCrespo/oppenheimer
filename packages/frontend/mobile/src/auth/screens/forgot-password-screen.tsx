import { Icon } from '@oppenheimer/design-system-mobile/icon';
import { MailCheck } from '@oppenheimer/design-system-mobile/icons';
import { Text } from '@oppenheimer/design-system-mobile/text';
import { useErrorMessage, useForgotPassword } from '@oppenheimer/frontend-core/react';
import type { Href } from 'expo-router';
import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { AuthLayout } from '../components/auth-layout';
import {
  AuthBackLink,
  AuthIconCircle,
  AuthLink,
  AuthNote,
  AuthSubtitle,
  AuthTitle,
} from '../components/auth-primitives';
import { ForgotPasswordForm } from '../forms/forgot-password-form';

export interface ForgotPasswordScreenProps {
  brandLabel?: string;
  loginHref: Href;
}

export function ForgotPasswordScreen({ brandLabel, loginHref }: ForgotPasswordScreenProps) {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const { mutate, isPending, error } = useForgotPassword();
  const [sentTo, setSentTo] = useState<string | null>(null);

  return (
    <AuthLayout brandLabel={brandLabel} legalNote={t('auth.forgotPassword.legal')}>
      {sentTo ? (
        <>
          <AuthIconCircle>
            <Icon as={MailCheck} size={24} className="text-ink-900" />
          </AuthIconCircle>
          <AuthTitle>{t('auth.forgotPassword.successTitle')}</AuthTitle>
          <AuthSubtitle>
            <Trans
              i18nKey="auth.forgotPassword.sentMessage"
              values={{ email: sentTo }}
              components={{ address: <Text className="font-medium text-ink-900" /> }}
            />
          </AuthSubtitle>
          <AuthNote>
            <Trans
              i18nKey="auth.forgotPassword.notReceived"
              components={{ retry: <AuthLink onPress={() => setSentTo(null)} /> }}
            />
          </AuthNote>
          <AuthBackLink href={loginHref} />
        </>
      ) : (
        <>
          <AuthTitle>{t('auth.forgotPassword.title')}</AuthTitle>
          <AuthSubtitle>{t('auth.forgotPassword.description')}</AuthSubtitle>
          <ForgotPasswordForm
            isPending={isPending}
            error={error ? resolveError(error, t('auth.forgotPassword.error')).message : undefined}
            onSubmit={({ email }) => mutate(email, { onSuccess: () => setSentTo(email) })}
          />
          <AuthBackLink href={loginHref} />
        </>
      )}
    </AuthLayout>
  );
}
