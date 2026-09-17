import { useLogin } from '@oppenheimer/frontend-core/react';
import {
  AuthSubtitle,
  AuthTitle,
  OAuthCallbackNotice,
  SocialLoginButtons,
  useErrorMessage,
} from '@oppenheimer/frontend-web';
import type { LoginDto } from '@oppenheimer/shared/schemas/auth';
import { Link, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { LoginForm } from '@/features/auth/forms/login-form';

export function LoginScreen({
  redirectTo,
  email,
  oauthError,
}: {
  redirectTo?: string;
  /** Prefills the form for an invitee who already has an account. */
  email?: string;
  /** Better Auth's `?error=<code>` from a failed social round-trip. */
  oauthError?: string;
}) {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const navigate = useNavigate();
  const { mutate, isPending, error } = useLogin();

  const onSubmit = (values: LoginDto) => {
    // The social banner describes the round-trip that just failed, not this
    // attempt. Drop it from the URL as the password attempt starts, or the two
    // failures stack and the reader cannot tell which one they are looking at.
    if (oauthError) {
      navigate({ to: '/login', search: (prev) => ({ ...prev, error: undefined }), replace: true });
    }

    mutate(values, {
      onSuccess: () => {
        // Split rather than pass the whole string as `to`: the target may
        // carry search params (`/settings?section=security`), and `to` is a
        // path — everything after the `?` would be swallowed into the pathname.
        const [pathname, query] = (redirectTo ?? '/sessions').split('?');
        navigate({
          to: pathname,
          search: Object.fromEntries(new URLSearchParams(query ?? '')),
        });
      },
    });
  };

  return (
    <>
      <AuthTitle>{t('auth.login.title')}</AuthTitle>
      <AuthSubtitle>{t('auth.login.description')}</AuthSubtitle>

      <OAuthCallbackNotice code={oauthError} className="mb-4" />

      <LoginForm
        defaultEmail={email}
        isPending={isPending}
        error={error ? resolveError(error, t('auth.login.invalidCredentials')).message : undefined}
        forgotPasswordLink={
          <Link
            to="/forgot-password"
            className="text-sm text-accent-blue transition-opacity hover:opacity-80"
          >
            {t('auth.login.forgotPassword')}
          </Link>
        }
        onSubmit={onSubmit}
      />

      <SocialLoginButtons disabled={isPending} />
    </>
  );
}
