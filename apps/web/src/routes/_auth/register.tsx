import { Button, FieldGroup, Input, PasswordInput } from '@oppenheimer/design-system-web';
import { useRegister } from '@oppenheimer/frontend/react';
import { type RegisterDto, registerSchema } from '@oppenheimer/shared/schemas/auth';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useForm, useWatch } from 'react-hook-form';
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
      navigate({ to: '/register', search: (prev) => ({ ...prev, error: undefined }), replace: true });
    }

    mutate(values, { onSuccess: () => navigate({ to: '/login' }) });
  });

  return (
    <>
      <AuthTitle>{t('auth.register.title')}</AuthTitle>
      <AuthSubtitle>{t('auth.register.description')}</AuthSubtitle>

      <OAuthCallbackNotice code={oauthError} className="mb-4" />

      {/* The one place a provider identity may become an account: these pass
          `sign-up`, which is what lifts the API's refusal. */}
      <SocialLoginButtons disabled={isPending} intent="sign-up" />

      <AuthDivider label={t('common.or')} />

      <form onSubmit={onSubmit} noValidate>
        <FieldGroup>
          {error && (
            <AuthFormError>{resolveError(error, t('auth.register.failed')).message}</AuthFormError>
          )}

          {/* The artboard asks for an email and a password only; the account
              schema still requires a name, so it stays as one compact row
              until that decision is made. */}
          <div className="grid grid-cols-2 gap-3">
            <AuthField label={t('auth.firstName')} htmlFor="firstName" error={errors.firstName}>
              <Input
                {...register('firstName')}
                id="firstName"
                size="lg"
                autoComplete="given-name"
                placeholder={t('auth.firstNamePlaceholder')}
                aria-invalid={Boolean(errors.firstName)}
                disabled={isPending}
              />
            </AuthField>
            <AuthField label={t('auth.lastName')} htmlFor="lastName" error={errors.lastName}>
              <Input
                {...register('lastName')}
                id="lastName"
                size="lg"
                autoComplete="family-name"
                placeholder={t('auth.lastNamePlaceholder')}
                aria-invalid={Boolean(errors.lastName)}
                disabled={isPending}
              />
            </AuthField>
          </div>

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

          <AuthField label={t('auth.password')} htmlFor="password" error={errors.password}>
            <PasswordInput
              {...register('password')}
              id="password"
              size="lg"
              autoComplete="new-password"
              placeholder={t('auth.register.passwordPlaceholder')}
              aria-invalid={Boolean(errors.password)}
              disabled={isPending}
              showLabel={t('auth.showPassword')}
              hideLabel={t('auth.hidePassword')}
            />
          </AuthField>

          <PasswordRequirements results={results} rules={RULES} />

          <Button type="submit" size="lg" block disabled={isPending || !satisfied}>
            {isPending ? t('auth.register.submitting') : t('auth.register.submit')}
          </Button>
        </FieldGroup>
      </form>

      <AuthFooterNote>
        {t('auth.register.hasAccount')} <AuthLink to="/login">{t('auth.register.signIn')}</AuthLink>
      </AuthFooterNote>
    </>
  );
}
