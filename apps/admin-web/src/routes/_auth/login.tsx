import { Button, Checkbox, FieldGroup, Input } from '@oppenheimer/design-system-web';
import { useLogin } from '@oppenheimer/frontend/react';
import { type LoginDto, loginSchema } from '@oppenheimer/shared/schemas/auth';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  AuthField,
  AuthFormError,
  AuthSubtitle,
  AuthTitle,
  authControlClass,
  authInputClass,
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
  component: LoginPage,
});

function LoginPage() {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const navigate = useNavigate();
  const { redirect: redirectTo, email, error: oauthError } = Route.useSearch();
  const { mutate, isPending, error } = useLogin();

  // Session lifetime is decided by the API, so this is presentational for now:
  // the control exists in the design and the preference has nowhere to go
  // until the login endpoint accepts one.
  const [keepSignedIn, setKeepSignedIn] = useState(true);

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
        const [pathname, query] = (redirectTo ?? '/users').split('?');
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

      <form onSubmit={onSubmit} noValidate>
        <FieldGroup className="gap-4">
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
              autoComplete="email"
              placeholder={t('auth.emailPlaceholder')}
              aria-invalid={Boolean(errors.email)}
              disabled={isPending}
              className={authInputClass}
            />
          </AuthField>

          <AuthField label={t('auth.password')} htmlFor="password" error={errors.password}>
            <Input
              {...register('password')}
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder={t('auth.passwordPlaceholder')}
              aria-invalid={Boolean(errors.password)}
              disabled={isPending}
              className={authInputClass}
            />
          </AuthField>

          {/* 21px is the design's row: a 15px box plus the 3px the UA puts around a
              native checkbox. Pinned so the column keeps its rhythm. */}
          <div className="mb-2 flex h-[21px] items-center justify-between">
            <label
              htmlFor="keepSignedIn"
              className="flex cursor-pointer items-center gap-2 text-sm text-ink-600"
            >
              <Checkbox
                id="keepSignedIn"
                checked={keepSignedIn}
                onCheckedChange={setKeepSignedIn}
                disabled={isPending}
                className="size-[15px] rounded-[4.5px] [&_svg]:size-2.5"
              />
              {t('auth.login.keepSignedIn')}
            </label>
            <Link
              to="/forgot-password"
              className="text-sm text-accent-blue transition-opacity hover:opacity-80"
            >
              {t('auth.login.forgotPassword')}
            </Link>
          </div>

          <Button type="submit" disabled={isPending} className={authControlClass}>
            {isPending ? t('auth.login.submitting') : t('auth.login.submit')}
          </Button>
        </FieldGroup>
      </form>

      <SocialLoginButtons disabled={isPending} />
    </>
  );
}
