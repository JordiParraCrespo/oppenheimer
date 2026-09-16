import { Button, FieldGroup, Input, PasswordInput } from '@oppenheimer/design-system-web';
import { registerSchema } from '@oppenheimer/shared/schemas/auth';
import { createFileRoute } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { z } from 'zod';
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

/**
 * The artboard asks for an email and a password only. The shared schema also
 * carries a name; whether that stays is a decision for when the call is
 * wired, so the form validates the two fields the screen shows.
 */
const createAccountSchema = registerSchema.pick({ email: true, password: true });

type CreateAccountValues = z.infer<typeof createAccountSchema>;

export const Route = createFileRoute('/_auth/register')({
  component: RegisterPage,
});

function RegisterPage() {
  const { t } = useTranslation();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateAccountValues>({
    resolver: useZodResolver(createAccountSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit((values) => scaffoldSubmit('Create account', values));

  return (
    <>
      <AuthTitle>{t('auth.register.title')}</AuthTitle>
      <AuthSubtitle>{t('auth.register.description')}</AuthSubtitle>

      <SocialLoginButtons intent="sign-up" />

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
            hint={t('auth.register.passwordHint')}
          >
            <PasswordInput
              {...register('password')}
              id="password"
              size="lg"
              autoComplete="new-password"
              placeholder={t('auth.register.passwordPlaceholder')}
              aria-invalid={Boolean(errors.password)}
              showLabel={t('auth.showPassword')}
              hideLabel={t('auth.hidePassword')}
            />
          </AuthField>

          <Button type="submit" size="lg" block>
            {t('auth.register.submit')}
          </Button>
        </FieldGroup>
      </form>

      <AuthFooterNote>
        {t('auth.register.hasAccount')} <AuthLink to="/login">{t('auth.register.signIn')}</AuthLink>
      </AuthFooterNote>
    </>
  );
}
