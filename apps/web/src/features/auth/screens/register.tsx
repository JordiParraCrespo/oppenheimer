import { useRegister } from '@oppenheimer/frontend-consumer/react';
import {
  AuthDivider,
  AuthFooterNote,
  AuthLink,
  AuthSubtitle,
  AuthTitle,
  OAuthCallbackNotice,
  SocialLoginButtons,
  useErrorMessage,
} from '@oppenheimer/frontend-web';
import type { RegisterDto } from '@oppenheimer/shared/schemas/auth';
import { useNavigate } from '@tanstack/react-router';
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

    // Sign-up creates the account and a workspace in one go, so the reader is
    // never stranded without one. What it cannot do is *name* either — so the
    // first-run flow opens on the step that does, and the console waits at the
    // end of it. The workspace the hook made is the default that step renames.
    mutate(values, { onSuccess: () => navigate({ to: '/onboarding/workspace' }) });
  };

  return (
    <>
      <AuthTitle>{t('auth.register.title')}</AuthTitle>
      <AuthSubtitle>{t('auth.register.description')}</AuthSubtitle>

      <OAuthCallbackNotice code={oauthError} className="mb-4" />

      {/* The one place a provider identity may become an account: these pass
          `sign-up`, which is what lifts the API's refusal. Without them the
          person the login screen sent here has no way to finish with the
          provider they started with. */}
      <SocialLoginButtons disabled={isPending} intent="sign-up" />

      <AuthDivider />

      <RegisterForm
        isPending={isPending}
        error={error ? resolveError(error, t('auth.register.failed')).message : undefined}
        onSubmit={onSubmit}
      />

      <AuthFooterNote>
        {t('auth.register.hasAccount')} <AuthLink to="/login">{t('auth.register.signIn')}</AuthLink>
      </AuthFooterNote>
    </>
  );
}
