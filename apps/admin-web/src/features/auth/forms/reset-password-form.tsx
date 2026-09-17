import { Button, FieldGroup } from '@oppenheimer/design-system-web';
import {
  AuthField,
  AuthFormError,
  authControlClass,
  checkPassword,
  meetsRequirements,
  PasswordInput,
  PasswordRequirements,
  type PasswordRule,
  useErrorMessage,
  useZodResolver,
} from '@oppenheimer/frontend-web';
import { resetPasswordSchema } from '@oppenheimer/shared/schemas/auth';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

/**
 * The token rides in the URL, so only the two password fields are user input.
 * Whether they match is not a schema rule: the live checklist below already
 * reports it and gates the submit button, and a `refine()` would need a
 * message string, which the shared schemas deliberately never carry.
 */
const newPasswordSchema = resetPasswordSchema
  .pick({ password: true })
  .extend({ confirmPassword: z.string().min(8) });

export type NewPasswordValues = z.infer<typeof newPasswordSchema>;

const RULES: readonly PasswordRule[] = ['length', 'case', 'number', 'match'];

export function ResetPasswordForm({
  isPending,
  error,
  onSubmit,
}: {
  isPending: boolean;
  error: Error | null;
  onSubmit: (values: NewPasswordValues) => void;
}) {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<NewPasswordValues>({
    resolver: useZodResolver(newPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const [password, confirmPassword] = useWatch({
    control,
    name: ['password', 'confirmPassword'],
  });
  const results = checkPassword(password ?? '', confirmPassword ?? '');
  const satisfied = meetsRequirements(results, RULES);

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <FieldGroup className="gap-4">
        {error && (
          <AuthFormError>
            {resolveError(error, t('auth.resetPassword.error')).message}
          </AuthFormError>
        )}

        <AuthField
          label={t('auth.resetPassword.newPassword')}
          htmlFor="password"
          error={errors.password}
        >
          <PasswordInput
            {...register('password')}
            id="password"
            autoComplete="new-password"
            placeholder={t('auth.resetPassword.newPasswordPlaceholder')}
            aria-invalid={Boolean(errors.password)}
            disabled={isPending}
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
            autoComplete="new-password"
            placeholder={t('auth.resetPassword.confirmPasswordPlaceholder')}
            aria-invalid={Boolean(errors.confirmPassword)}
            disabled={isPending}
          />
        </AuthField>

        <PasswordRequirements results={results} rules={RULES} className="-mt-1.5 mb-1.5" />

        <Button type="submit" disabled={isPending || !satisfied} className={authControlClass}>
          {isPending ? t('auth.resetPassword.submitting') : t('auth.resetPassword.submit')}
        </Button>
      </FieldGroup>
    </form>
  );
}
