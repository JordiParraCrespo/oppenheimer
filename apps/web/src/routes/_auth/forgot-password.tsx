import { Button, FieldGroup, Input } from '@oppenheimer/design-system-web';
import { useForgotPassword } from '@oppenheimer/frontend/react';
import { type ForgotPasswordDto, forgotPasswordSchema } from '@oppenheimer/shared/schemas/auth';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Trans, useTranslation } from 'react-i18next';
import { useAuthLegalNote } from '@/components/auth/auth-legal-note';
import {
  AuthBackLink,
  AuthField,
  AuthFooterNote,
  AuthFormError,
  AuthSubtitle,
  AuthTitle,
} from '@/components/auth/auth-primitives';
import { useErrorMessage } from '@/lib/use-error-message';
import { useZodResolver } from '@/lib/use-zod-resolver';

export const Route = createFileRoute('/_auth/forgot-password')({
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const { mutate, isPending, error } = useForgotPassword();

  // Held locally rather than read off the mutation so "use a different
  // address" can walk the screen back to the request state without the
  // success flag dragging it forward again.
  const [sentTo, setSentTo] = useState<string | null>(null);

  useAuthLegalNote(t('auth.forgotPassword.legal'));

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordDto>({
    resolver: useZodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = handleSubmit(({ email }) =>
    mutate(email, { onSuccess: () => setSentTo(email) }),
  );

  if (sentTo) {
    return (
      <>
        <AuthTitle>{t('auth.forgotPassword.successTitle')}</AuthTitle>
        <AuthSubtitle>
          <Trans
            i18nKey="auth.forgotPassword.sentMessage"
            values={{ email: sentTo }}
            components={{ address: <span className="figures text-fg" /> }}
          />
        </AuthSubtitle>

        <Button
          variant="secondary"
          size="lg"
          block
          disabled={isPending}
          onClick={() => mutate(sentTo)}
        >
          {isPending ? t('auth.forgotPassword.submitting') : t('auth.forgotPassword.resend')}
        </Button>

        <AuthFooterNote>
          <button
            type="button"
            onClick={() => setSentTo(null)}
            className="text-link hover:underline"
          >
            {t('auth.forgotPassword.differentAddress')}
          </button>
        </AuthFooterNote>
        <AuthBackLink />
      </>
    );
  }

  return (
    <>
      <AuthTitle>{t('auth.forgotPassword.title')}</AuthTitle>
      <AuthSubtitle>{t('auth.forgotPassword.description')}</AuthSubtitle>

      <form onSubmit={onSubmit} noValidate>
        <FieldGroup>
          {error && (
            <AuthFormError>
              {resolveError(error, t('auth.forgotPassword.error')).message}
            </AuthFormError>
          )}

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

      <AuthBackLink />
    </>
  );
}
