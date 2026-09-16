import { Button, FieldGroup, Input } from '@oppenheimer/design-system-web';
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
  AuthSubtitle,
  AuthTitle,
} from '@/components/auth/auth-primitives';
import { scaffoldSubmit } from '@/components/auth/scaffold-submit';
import { useZodResolver } from '@/lib/use-zod-resolver';

export const Route = createFileRoute('/_auth/forgot-password')({
  component: ForgotPasswordPage,
});

/**
 * Two artboards, one route: the request form, then "Check your email" once
 * an address has been submitted. Held locally so "use a different address"
 * walks the screen back.
 */
function ForgotPasswordPage() {
  const { t } = useTranslation();
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

  const onSubmit = handleSubmit(({ email }) => {
    scaffoldSubmit('Send reset link', { email });
    setSentTo(email);
  });

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
          onClick={() => scaffoldSubmit('Resend link', { email: sentTo })}
        >
          {t('auth.forgotPassword.resend')}
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
          <AuthField
            label={t('auth.forgotPassword.emailLabel')}
            htmlFor="email"
            error={errors.email}
          >
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

          <Button type="submit" size="lg" block>
            {t('auth.forgotPassword.submit')}
          </Button>
        </FieldGroup>
      </form>

      <AuthBackLink />
    </>
  );
}
