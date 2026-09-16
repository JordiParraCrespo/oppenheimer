import { Button, FieldGroup, Input, PasswordInput } from '@oppenheimer/design-system-web';
import { type LoginDto, loginSchema } from '@oppenheimer/shared/schemas/auth';
import { createFileRoute } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  AuthDivider,
  AuthField,
  AuthFooterNote,
  AuthLink,
  AuthSubtitle,
  AuthTitle,
} from '@/components/auth/auth-primitives';
import { scaffoldSubmit } from '@/components/auth/scaffold-submit';
import { SocialLoginButtons } from '@/components/social-login-buttons';
import { useZodResolver } from '@/lib/use-zod-resolver';

export const Route = createFileRoute('/_auth/login')({
  validateSearch: (search: Record<string, unknown>): { redirect?: string; email?: string } => ({
    // Kept so the `_authenticated` layout's bounce and the invitation flow
    // keep their links valid; read again when the sign-in call is wired.
    redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
    email: typeof search.email === 'string' ? search.email : undefined,
  }),
  component: LoginPage,
});

function LoginPage() {
  const { t } = useTranslation();
  const { email } = Route.useSearch();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginDto>({
    resolver: useZodResolver(loginSchema),
    defaultValues: { email: email ?? '', password: '' },
  });

  const onSubmit = handleSubmit((values) => scaffoldSubmit('Sign in', values));

  return (
    <>
      <AuthTitle>{t('auth.login.title')}</AuthTitle>
      <AuthSubtitle>{t('auth.login.description')}</AuthSubtitle>

      <SocialLoginButtons />

      <AuthDivider label={t('common.or')} />

      <form onSubmit={onSubmit} noValidate>
        <FieldGroup>
          <AuthField label={t('auth.email')} htmlFor="email" error={errors.email}>
            <Input
              {...register('email')}
              id="email"
              type="email"
              size="lg"
              autoComplete="email"
              placeholder={t('auth.emailPlaceholder')}
              aria-invalid={Boolean(errors.email)}
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
              showLabel={t('auth.showPassword')}
              hideLabel={t('auth.hidePassword')}
            />
          </AuthField>

          <Button type="submit" size="lg" block>
            {t('auth.login.submit')}
          </Button>
        </FieldGroup>
      </form>

      <AuthFooterNote>
        {t('auth.login.noAccount')} <AuthLink to="/register">{t('auth.login.signUp')}</AuthLink>
      </AuthFooterNote>
    </>
  );
}
