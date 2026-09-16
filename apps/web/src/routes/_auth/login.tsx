import { Button, FieldGroup, Input, PasswordInput } from '@oppenheimer/design-system-web';
import { useLogin } from '@oppenheimer/frontend/react';
import { type LoginDto, loginSchema } from '@oppenheimer/shared/schemas/auth';
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  AuthDivider,
  AuthField,
  AuthFooterNote,
  AuthFormError,
  AuthLink,
  AuthSubtitle,
  AuthTitle,
} from '@/components/auth/auth-primitives';
import { OAuthCallbackNotice } from '@/components/auth/oauth-callback-notice';
import { SocialLoginButtons } from '@/components/social-login-buttons';
import { sanitizeRedirect } from '@/lib/sanitize-redirect';
import { useErrorMessage } from '@/lib/use-error-message';
import { useZodResolver } from '@/lib/use-zod-resolver';

export const Route = createFileRoute('/_auth/login')({
  validateSearch: (
    search: Record<string, unknown>,
  ): { redirect?: string; email?: string; error?: string } => ({
    redirect: sanitizeRedirect(search.redirect),
    // Prefills the form for an invitee who already has an account.
    email: typeof search.email === 'string' ? search.email : undefined,
    // Better Auth appends `?error=<code>` when a social round-trip fails, and
    // this is the screen it comes back to. Naming it here is what keeps it:
    // `validateSearch` *replaces* the route's search, so a param it does not
    // return is dropped before the component can read it.
    error: typeof search.error === 'string' ? search.error : undefined,
  }),
  beforeLoad: ({ search }) => {
    // Someone who pressed "Continue with Google" with no account here is not
    // failing to sign in — they are trying to sign up, which the API refuses
    // from this screen on purpose. Hand them the screen that can finish it.
    if (search.error === 'signup_disabled') {
      throw redirect({ to: '/register', search: { error: search.error }, replace: true });
    }
  },
  component: LoginPage,
});

function LoginPage() {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const navigate = useNavigate();
  const { redirect: redirectTo, email, error: oauthError } = Route.useSearch();
  const { mutate, isPending, error } = useLogin();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginDto>({
    resolver: useZodResolver(loginSchema),
    defaultValues: { email: email ?? '', password: '' },
  });

  const onSubmit = handleSubmit((values) => {
    // The social banner describes the round-trip that just failed, not this
    // attempt. Drop it from the URL as the password attempt starts.
    if (oauthError) {
      navigate({ to: '/login', search: (prev) => ({ ...prev, error: undefined }), replace: true });
    }

    mutate(values, {
      onSuccess: () => {
        // Split rather than pass the whole string as `to`: the target may
        // carry search params, and `to` is a path.
        const [pathname, query] = (redirectTo ?? '/sessions').split('?');
        navigate({
          to: pathname,
          search: Object.fromEntries(new URLSearchParams(query ?? '')),
        });
      },
    });
  });

  return (
    <>
      <AuthTitle>{t('auth.login.title')}</AuthTitle>
      <AuthSubtitle>{t('auth.login.description')}</AuthSubtitle>

      <OAuthCallbackNotice code={oauthError} className="mb-4" />

      <SocialLoginButtons disabled={isPending} />

      <AuthDivider label={t('common.or')} />

      <form onSubmit={onSubmit} noValidate>
        <FieldGroup>
          {error && (
            <AuthFormError>
              {resolveError(error, t('auth.login.invalidCredentials')).message}
            </AuthFormError>
          )}

          <AuthField label={t('auth.email')} htmlFor="email" error={errors.email}>
            <Input
              {...register('email')}
              id="email"
              type="email"
              size="lg"
              autoComplete="email"
              placeholder={t('auth.emailPlaceholder')}
              aria-invalid={Boolean(errors.email)}
              disabled={isPending}
            />
          </AuthField>

          <AuthField
            label={t('auth.password')}
            htmlFor="password"
            error={errors.password}
            action={<AuthLink to="/forgot-password">{t('auth.login.forgotPassword')}</AuthLink>}
          >
            <PasswordInput
              {...register('password')}
              id="password"
              size="lg"
              autoComplete="current-password"
              placeholder={t('auth.passwordPlaceholder')}
              aria-invalid={Boolean(errors.password)}
              disabled={isPending}
              showLabel={t('auth.showPassword')}
              hideLabel={t('auth.hidePassword')}
            />
          </AuthField>

          <Button type="submit" size="lg" block disabled={isPending}>
            {isPending ? t('auth.login.submitting') : t('auth.login.submit')}
          </Button>
        </FieldGroup>
      </form>

      <AuthFooterNote>
        {t('auth.login.noAccount')} <AuthLink to="/register">{t('auth.login.signUp')}</AuthLink>
      </AuthFooterNote>
    </>
  );
}
