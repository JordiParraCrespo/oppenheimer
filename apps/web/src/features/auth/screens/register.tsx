import { useRegister } from '@oppenheimer/frontend-consumer/react';
import {
  AuthFooterNote,
  AuthSubtitle,
  AuthTitle,
  OAuthCallbackNotice,
  SocialLoginButtons,
  useErrorMessage,
} from '@oppenheimer/frontend-web';
import type { RegisterDto } from '@oppenheimer/shared/schemas/auth';
import { Link, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { RegisterForm } from '@/features/auth/forms/register-form';

export function RegisterScreen({
  oauthError,
}: {
  /** The code of a social round-trip that failed and landed here. */
  oauthError?: string;
}) {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const navigate = useNavigate();
  const { mutate, isPending, error } = useRegister();

  const onSubmit = (values: RegisterDto) => {
    // The social banner is about the round-trip that sent them here, not about
    // the form they are submitting now.
    if (oauthError) {
      navigate({
        to: '/register',
        search: (prev) => ({ ...prev, error: undefined }),
        replace: true,
      });
    }

    mutate(values, {
      onSuccess: () => {
        navigate({ to: '/login' });
      },
    });
  };

  return (
    <>
      <AuthTitle>{t('auth.register.title')}</AuthTitle>
      <AuthSubtitle>{t('auth.register.description')}</AuthSubtitle>

      <OAuthCallbackNotice code={oauthError} className="mb-4" />

      <RegisterForm
        isPending={isPending}
        error={error ? resolveError(error, t('auth.register.failed')).message : undefined}
        onSubmit={onSubmit}
      />

      {/* The one place a provider identity may become an account: these pass
          `sign-up`, which is what lifts the API's refusal. Without them the
          person the login screen sent here has no way to finish with the
          provider they started with. */}
      <SocialLoginButtons disabled={isPending} intent="sign-up" />

      <AuthFooterNote>
        {t('auth.register.hasAccount')}{' '}
        <Link to="/login" className="text-accent-blue transition-opacity hover:opacity-80">
          {t('auth.register.signIn')}
        </Link>
      </AuthFooterNote>
    </>
  );
}
