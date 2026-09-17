import { Button, FieldGroup, Input } from '@oppenheimer/design-system-web';
import {
  AuthField,
  AuthFormError,
  authControlClass,
  authInputClass,
  useErrorMessage,
  useZodResolver,
} from '@oppenheimer/frontend-web';
import { type ForgotPasswordDto, forgotPasswordSchema } from '@oppenheimer/shared/schemas/auth';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

export function ForgotPasswordForm({
  isPending,
  error,
  onSubmit,
}: {
  isPending: boolean;
  error: Error | null;
  onSubmit: (values: ForgotPasswordDto) => void;
}) {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();

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
      <FieldGroup className="gap-4">
        {error && (
          <AuthFormError>
            {resolveError(error, t('auth.forgotPassword.error')).message}
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

        <Button type="submit" disabled={isPending} className={authControlClass}>
          {isPending ? t('auth.forgotPassword.submitting') : t('auth.forgotPassword.submit')}
        </Button>
      </FieldGroup>
    </form>
  );
}
