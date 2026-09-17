import { Button, FieldGroup, Input, PasswordInput } from '@oppenheimer/design-system-web';
import { AuthField, AuthFormError, useZodResolver } from '@oppenheimer/frontend-web';
import { type LoginDto, loginSchema } from '@oppenheimer/shared/schemas/auth';
import type { ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

export function LoginForm({
  defaultEmail,
  isPending,
  error,
  forgotPasswordLink,
  onSubmit,
}: {
  defaultEmail?: string;
  isPending: boolean;
  /** The resolved failure message, if the last attempt failed. */
  error?: string;
  /** The "Forgot password?" link, rendered beside the password label. */
  forgotPasswordLink: ReactNode;
  onSubmit: (values: LoginDto) => void;
}) {
  const { t } = useTranslation();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginDto>({
    resolver: useZodResolver(loginSchema),
    defaultValues: { email: defaultEmail ?? '', password: '' },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        {error && <AuthFormError>{error}</AuthFormError>}

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
          action={forgotPasswordLink}
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
  );
}
