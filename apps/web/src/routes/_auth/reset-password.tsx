import { Button, FieldGroup, PasswordInput } from '@oppenheimer/design-system-web';
import { resetPasswordSchema } from '@oppenheimer/shared/schemas/auth';
import { createFileRoute } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useAuthLegalNote } from '@/components/auth/auth-legal-note';
import { AuthField, AuthNote, AuthSubtitle, AuthTitle } from '@/components/auth/auth-primitives';
import { scaffoldSubmit } from '@/components/auth/scaffold-submit';
import { useZodResolver } from '@/lib/use-zod-resolver';

/**
 * The token rides in the URL, so only the two password fields are user input.
 * Whether they match is checked here, not in the shared schema, which
 * deliberately carries no messages.
 */
const newPasswordSchema = resetPasswordSchema
  .pick({ password: true })
  .extend({ confirmPassword: z.string().min(8) })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

type NewPasswordValues = z.infer<typeof newPasswordSchema>;

export const Route = createFileRoute('/_auth/reset-password')({
  validateSearch: (search: Record<string, unknown>): { token?: string; email?: string } => ({
    token: typeof search.token === 'string' ? search.token : undefined,
    email: typeof search.email === 'string' ? search.email : undefined,
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { t } = useTranslation();
  const { token, email } = Route.useSearch();

  useAuthLegalNote(t('auth.resetPassword.legal'));

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<NewPasswordValues>({
    resolver: useZodResolver(newPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const onSubmit = handleSubmit(({ password }) =>
    scaffoldSubmit('Save and sign in', { token, password }),
  );

  return (
    <>
      <AuthTitle>{t('auth.resetPassword.title')}</AuthTitle>
      <AuthSubtitle>
        {email
          ? t('auth.resetPassword.descriptionFor', { email })
          : t('auth.resetPassword.description')}
      </AuthSubtitle>

      <form onSubmit={onSubmit} noValidate>
        <FieldGroup>
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
              showLabel={t('auth.showPassword')}
              hideLabel={t('auth.hidePassword')}
            />
          </AuthField>

          <Button type="submit" size="lg" block>
            {t('auth.resetPassword.submit')}
          </Button>
        </FieldGroup>
      </form>

      <AuthNote>{t('auth.resetPassword.note')}</AuthNote>
    </>
  );
}
