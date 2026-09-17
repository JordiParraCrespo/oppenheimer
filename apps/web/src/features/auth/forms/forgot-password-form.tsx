import { Button, FieldGroup, Input } from '@oppenheimer/design-system-web';
import { AuthField, AuthFormError, useZodResolver } from '@oppenheimer/frontend-web';
import { type ForgotPasswordDto, forgotPasswordSchema } from '@oppenheimer/shared/schemas/auth';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

export function ForgotPasswordForm({
  isPending,
  error,
  onSubmit,
}: {
  isPending: boolean;
  /** The resolved failure message, if the last attempt failed. */
  error?: string;
  onSubmit: (values: ForgotPasswordDto) => void;
}) {
  const { t } = useTranslation();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordDto>({
    resolver: useZodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        {error && <AuthFormError>{error}</AuthFormError>}

        <AuthField label={t('auth.forgotPassword.emailLabel')} htmlFor="email" error={errors.email}>
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

        <Button type="submit" size="lg" block disabled={isPending}>
          {isPending ? t('auth.forgotPassword.submitting') : t('auth.forgotPassword.submit')}
        </Button>
      </FieldGroup>
    </form>
  );
}
