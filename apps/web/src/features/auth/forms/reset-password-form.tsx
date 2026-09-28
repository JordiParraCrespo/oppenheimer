import { Button, FieldGroup, PasswordInput } from '@oppenheimer/design-system-web';
import {
  AuthField,
  AuthFormError,
  type ResolvedErrorMessage,
  useServerFieldErrors,
  useZodResolver,
} from '@oppenheimer/frontend-web';
import { resetPasswordSchema } from '@oppenheimer/shared/schemas/auth';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

/**
 * The token rides in the URL, so only the two password fields are user input.
 * Whether they match is checked here, not in the shared schema, which
 * deliberately carries no messages. A `refine` states its own message, which
 * skips the translated error map, so the message is passed in already
 * translated rather than written here in English.
 */
function newPasswordSchema(mismatch: string) {
  return resetPasswordSchema
    .pick({ password: true })
    .extend({ confirmPassword: z.string().min(8) })
    .refine((values) => values.password === values.confirmPassword, {
      path: ['confirmPassword'],
      message: mismatch,
    });
}

export type NewPasswordValues = z.infer<ReturnType<typeof newPasswordSchema>>;

export function ResetPasswordForm({
  isPending,
  error,
  onSubmit,
}: {
  isPending: boolean;
  /** The resolved failure message, if the last attempt failed. */
  error?: ResolvedErrorMessage;
  onSubmit: (values: NewPasswordValues) => void;
}) {
  const { t } = useTranslation();

  const {
    setError,
    getValues,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<NewPasswordValues>({
    resolver: useZodResolver(newPasswordSchema(t('auth.passwordsDoNotMatch'))),
    defaultValues: { password: '', confirmPassword: '' },
  });
  // Fields the server refused are marked on the fields themselves.
  useServerFieldErrors({ setError, getValues }, error);

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        {error && <AuthFormError>{error.message}</AuthFormError>}

        <AuthField
          label={t('auth.resetPassword.newPassword')}
          htmlFor="password"
          error={errors.password}
        >
          <PasswordInput
            {...register('password')}
            id="password"
            size="lg"
            autoComplete="new-password"
            placeholder={t('auth.resetPassword.newPasswordPlaceholder')}
            aria-invalid={Boolean(errors.password)}
            disabled={isPending}
            showLabel={t('auth.showPassword')}
            hideLabel={t('auth.hidePassword')}
          />
        </AuthField>

        <AuthField
          label={t('auth.resetPassword.confirmPassword')}
          htmlFor="confirmPassword"
          error={errors.confirmPassword}
        >
          <PasswordInput
            {...register('confirmPassword')}
            id="confirmPassword"
            size="lg"
            autoComplete="new-password"
            placeholder={t('auth.resetPassword.confirmPasswordPlaceholder')}
            aria-invalid={Boolean(errors.confirmPassword)}
            disabled={isPending}
            showLabel={t('auth.showPassword')}
            hideLabel={t('auth.hidePassword')}
          />
        </AuthField>

        <Button type="submit" size="lg" block disabled={isPending}>
          {isPending ? t('auth.resetPassword.submitting') : t('auth.resetPassword.submit')}
        </Button>
      </FieldGroup>
    </form>
  );
}
