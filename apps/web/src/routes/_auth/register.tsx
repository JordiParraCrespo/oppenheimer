import { Button, FieldGroup, Input } from '@oppenheimer/design-system-web';
import { useRegister } from '@oppenheimer/frontend/react';
import { type RegisterDto, registerSchema } from '@oppenheimer/shared/schemas/auth';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  AuthField,
  AuthFooterNote,
  AuthFormError,
  AuthSubtitle,
  AuthTitle,
  authControlClass,
  authInputClass,
} from '@/components/auth/auth-primitives';
import { OAuthCallbackNotice } from '@/components/auth/oauth-callback-notice';
import { PasswordInput } from '@/components/auth/password-input';
import {
  checkPassword,
  meetsRequirements,
  PasswordRequirements,
  type PasswordRule,
} from '@/components/auth/password-requirements';
import { SocialLoginButtons } from '@/components/social-login-buttons';
import { useErrorMessage } from '@/lib/use-error-message';
import { useZodResolver } from '@/lib/use-zod-resolver';

const RULES: readonly PasswordRule[] = ['length', 'case', 'number'];

export const Route = createFileRoute('/_auth/register')({
  validateSearch: (search: Record<string, unknown>): { error?: string } => ({
    // Set two ways, both of them a redirect the app never saw: the login
    // screen forwards a `signup_disabled` here, and a social *sign-up* that
    // fails comes straight back with its own code.
    error: typeof search.error === 'string' ? search.error : undefined,
  }),
  component: RegisterPage,
});

function RegisterPage() {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const navigate = useNavigate();
  const { mutate, isPending, error } = useRegister();
  const { error: oauthError } = Route.useSearch();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<RegisterDto>({
    resolver: useZodResolver(registerSchema),
    defaultValues: { firstName: '', lastName: '', email: '', password: '' },
  });

  const password = useWatch({ control, name: 'password' });
  const results = checkPassword(password ?? '');
  const satisfied = meetsRequirements(results, RULES);

  const onSubmit = handleSubmit((values) => {
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
  });

  return (
    <>
      <AuthTitle>{t('auth.register.title')}</AuthTitle>
      <AuthSubtitle>{t('auth.register.description')}</AuthSubtitle>

      <OAuthCallbackNotice code={oauthError} className="mb-4" />

      <form onSubmit={onSubmit} noValidate>
        <FieldGroup className="gap-4">
          {error && (
            <AuthFormError>{resolveError(error, t('auth.register.failed')).message}</AuthFormError>
          )}

          <div className="grid grid-cols-2 gap-3">
            <AuthField label={t('auth.firstName')} htmlFor="firstName" error={errors.firstName}>
              <Input
                {...register('firstName')}
                id="firstName"
                autoComplete="given-name"
                placeholder={t('auth.firstNamePlaceholder')}
                aria-invalid={Boolean(errors.firstName)}
                disabled={isPending}
                className={authInputClass}
              />
            </AuthField>
            <AuthField label={t('auth.lastName')} htmlFor="lastName" error={errors.lastName}>
              <Input
                {...register('lastName')}
                id="lastName"
                autoComplete="family-name"
                placeholder={t('auth.lastNamePlaceholder')}
                aria-invalid={Boolean(errors.lastName)}
                disabled={isPending}
                className={authInputClass}
              />
            </AuthField>
          </div>

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

          <AuthField
            label={t('auth.register.passwordLabel')}
            htmlFor="password"
            error={errors.password}
          >
            <PasswordInput
              {...register('password')}
              id="password"
              autoComplete="new-password"
              placeholder={t('auth.register.passwordPlaceholder')}
              aria-invalid={Boolean(errors.password)}
              disabled={isPending}
            />
          </AuthField>

          <PasswordRequirements results={results} rules={RULES} className="-mt-1.5 mb-1.5" />

          <Button type="submit" disabled={isPending || !satisfied} className={authControlClass}>
            {isPending ? t('auth.register.submitting') : t('auth.register.submit')}
          </Button>
        </FieldGroup>
      </form>

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
