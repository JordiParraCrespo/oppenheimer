import { Button } from '@oppenheimer/design-system-web';
import { useForgotPassword } from '@oppenheimer/frontend-core/react';
import {
  AuthBackLink,
  AuthFooterNote,
  AuthSubtitle,
  AuthTitle,
  useErrorMessage,
} from '@oppenheimer/frontend-web';
import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { ForgotPasswordForm } from '@/features/auth/forms/forgot-password-form';

/**
 * Two artboards, one screen: the request form, then "Check your email" once
 * an address has been submitted. Held locally rather than read off the
 * mutation so "use a different address" can walk the screen back without the
 * success flag dragging it forward again.
 */
export function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const { mutate, isPending, error } = useForgotPassword();
  const [sentTo, setSentTo] = useState<string | null>(null);

  if (sentTo) {
    return (
      <>
        <AuthTitle>{t('auth.forgotPassword.successTitle')}</AuthTitle>
        <AuthSubtitle>
          <Trans
            i18nKey="auth.forgotPassword.sentMessage"
            values={{ email: sentTo }}
            components={{ address: <span className="figures text-fg" /> }}
          />
        </AuthSubtitle>

        <Button
          variant="secondary"
          size="lg"
          block
          disabled={isPending}
          onClick={() => mutate(sentTo)}
        >
          {isPending ? t('auth.forgotPassword.submitting') : t('auth.forgotPassword.resend')}
        </Button>

        <AuthFooterNote>
          <button
            type="button"
            onClick={() => setSentTo(null)}
            className="text-link hover:underline"
          >
            {t('auth.forgotPassword.differentAddress')}
          </button>
        </AuthFooterNote>
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
