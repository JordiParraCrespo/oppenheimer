import { Button, FieldGroup } from '@oppenheimer/design-system-web';
import { Mail, ShieldAlert, ShieldCheck } from '@oppenheimer/design-system-web/icons';
import { useResetPassword } from '@oppenheimer/frontend/react';
import { resetPasswordSchema } from '@oppenheimer/shared/schemas/auth';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useAuthLegalNote } from '@/components/auth/auth-legal-note';
import {
  AuthBackLink,
  AuthEmailChip,
  AuthField,
  AuthFormError,
  AuthIconCircle,
  AuthSubtitle,
  AuthTitle,
  authControlClass,
} from '@/components/auth/auth-primitives';
import { PasswordInput } from '@/components/auth/password-input';
import {
  checkPassword,
  meetsRequirements,
  PasswordRequirements,
  type PasswordRule,
} from '@/components/auth/password-requirements';
import { useErrorMessage } from '@/lib/use-error-message';
import { useZodResolver } from '@/lib/use-zod-resolver';

/**
 * The token rides in the URL, so only the two password fields are user input.
 * Whether they match is not a schema rule: the live checklist below already
 * reports it and gates the submit button, and a `refine()` would need a
 * message string, which the shared schemas deliberately never carry.
 */
const newPasswordSchema = resetPasswordSchema
  .pick({ password: true })
  .extend({ confirmPassword: z.string().min(8) });

type NewPasswordValues = z.infer<typeof newPasswordSchema>;

const RULES: readonly PasswordRule[] = ['length', 'case', 'number', 'match'];

export const Route = createFileRoute('/_auth/reset-password')({
  validateSearch: (
    search: Record<string, unknown>,
  ): { token?: string; error?: string; email?: string } => ({
    token: (search.token as string) || undefined,
    error: (search.error as string) || undefined,
    email: (search.email as string) || undefined,
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const { token, error: linkError, email } = Route.useSearch();
  const { mutate, isPending, error } = useResetPassword();
  const [done, setDone] = useState(false);

  useAuthLegalNote(t('auth.resetPassword.legal'));

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

  const onSubmit = handleSubmit((values) => {
    if (!token) return;
    mutate({ token, password: values.password }, { onSuccess: () => setDone(true) });
  });

  if (!token || linkError) {
    return (
      <>
        <AuthIconCircle>
          <ShieldAlert />
        </AuthIconCircle>
        <AuthTitle>{t('auth.resetPassword.invalidTitle')}</AuthTitle>
        <AuthSubtitle>{t('auth.resetPassword.invalidMessage')}</AuthSubtitle>
        <Button render={<Link to="/forgot-password" />} className={authControlClass}>
          {t('auth.resetPassword.requestNewLink')}
        </Button>
        <AuthBackLink />
      </>
    );
  }

  if (done) {
    return (
      <>
        <AuthIconCircle>
          <ShieldCheck />
        </AuthIconCircle>
        <AuthTitle>{t('auth.resetPassword.successTitle')}</AuthTitle>
        <AuthSubtitle>{t('auth.resetPassword.successMessage')}</AuthSubtitle>
        <Button render={<Link to="/login" />} className={authControlClass}>
          {t('auth.resetPassword.continue')}
        </Button>
      </>
    );
  }

  return (
    <>
      <AuthTitle>{t('auth.resetPassword.title')}</AuthTitle>
      <AuthSubtitle>{t('auth.resetPassword.description')}</AuthSubtitle>

      {email && (
        <AuthEmailChip>
          <Mail />
          {email}
        </AuthEmailChip>
      )}

      <form onSubmit={onSubmit} noValidate>
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
    </>
  );
}
