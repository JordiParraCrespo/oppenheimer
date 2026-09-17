import { MailCheck } from '@oppenheimer/design-system-web/icons';
import { useForgotPassword } from '@oppenheimer/frontend-core/react';
import {
  AuthBackLink,
  AuthIconCircle,
  AuthNote,
  AuthSubtitle,
  AuthTitle,
  useErrorMessage,
} from '@oppenheimer/frontend-web';
import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { ForgotPasswordForm } from '@/features/auth/forms/forgot-password-form';

export function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const { mutate, isPending, error } = useForgotPassword();

  // Held locally rather than read off the mutation so that "try another
  // email" can walk the screen back to the request state without the success
  // flag dragging it forward again.
  const [sentTo, setSentTo] = useState<string | null>(null);

  if (sentTo) {
    return (
      <>
        <AuthIconCircle>
          <MailCheck />
        </AuthIconCircle>
        <AuthTitle>{t('auth.forgotPassword.successTitle')}</AuthTitle>
        <AuthSubtitle>
          <Trans
            i18nKey="auth.forgotPassword.sentMessage"
            values={{ email: sentTo }}
            components={{
              address: <strong className="font-medium text-ink-900" />,
            }}
          />
        </AuthSubtitle>
        <AuthNote>
          <Trans
            i18nKey="auth.forgotPassword.notReceived"
            components={{
              retry: (
                <button
                  type="button"
                  onClick={() => setSentTo(null)}
                  className="text-accent-blue transition-opacity hover:opacity-80"
                />
              ),
            }}
          />
        </AuthNote>
        <AuthBackLink />
      </>
    );
  }

  return (
    <>
      <AuthTitle>{t('auth.forgotPassword.title')}</AuthTitle>
      <AuthSubtitle>{t('auth.forgotPassword.description')}</AuthSubtitle>

      <ForgotPasswordForm
        isPending={isPending}
        error={error ? resolveError(error, t('auth.forgotPassword.error')).message : undefined}
        onSubmit={({ email }) => mutate(email, { onSuccess: () => setSentTo(email) })}
      />

      <AuthBackLink />
    </>
  );
}
