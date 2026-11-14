import { Button } from '@oppenheimer/design-system-mobile/button';
import { Icon } from '@oppenheimer/design-system-mobile/icon';
import { ShieldAlert, ShieldCheck } from '@oppenheimer/design-system-mobile/icons';
import { Text } from '@oppenheimer/design-system-mobile/text';
import { useErrorMessage, useResetPassword } from '@oppenheimer/frontend-core/react';
import { type Href, Link, useLocalSearchParams } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthLayout } from '../components/auth-layout';
import {
  AuthBackLink,
  AuthIconCircle,
  AuthSubtitle,
  AuthTitle,
  authControlClass,
} from '../components/auth-primitives';
import { ResetPasswordForm } from '../forms/reset-password-form';

export interface ResetPasswordScreenProps {
  brandLabel?: string;
  forgotPasswordHref: Href;
  loginHref: Href;
}

export function ResetPasswordScreen({
  brandLabel,
  forgotPasswordHref,
  loginHref,
}: ResetPasswordScreenProps) {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const { token } = useLocalSearchParams<{ token?: string }>();
  const { mutate, isPending, error } = useResetPassword();
  const [done, setDone] = useState(false);

  const stage = resetStage(token, done);
  let content: ReactNode;
  switch (stage.kind) {
    case 'invalid-link':
      content = (
        <>
          <AuthIconCircle>
            <Icon as={ShieldAlert} size={24} className="text-ink-900" />
          </AuthIconCircle>
          <AuthTitle>{t('auth.resetPassword.invalidTitle')}</AuthTitle>
          <AuthSubtitle>{t('auth.resetPassword.invalidMessage')}</AuthSubtitle>
          <Link href={forgotPasswordHref} asChild>
            <Button className={authControlClass}>
              <Text>{t('auth.resetPassword.requestNewLink')}</Text>
            </Button>
          </Link>
          <AuthBackLink href={loginHref} />
        </>
      );
      break;
    case 'done':
      content = (
        <>
          <AuthIconCircle>
            <Icon as={ShieldCheck} size={24} className="text-ink-900" />
          </AuthIconCircle>
          <AuthTitle>{t('auth.resetPassword.successTitle')}</AuthTitle>
          <AuthSubtitle>{t('auth.resetPassword.successMessage')}</AuthSubtitle>
          <Link href={loginHref} asChild>
            <Button className={authControlClass}>
              <Text>{t('auth.resetPassword.continue')}</Text>
            </Button>
          </Link>
        </>
      );
      break;
    case 'form':
      content = (
        <>
          <AuthTitle>{t('auth.resetPassword.title')}</AuthTitle>
          <AuthSubtitle>{t('auth.resetPassword.description')}</AuthSubtitle>
          <ResetPasswordForm
            isPending={isPending}
            error={error ? resolveError(error, t('auth.resetPassword.error')).message : undefined}
            onSubmit={({ password }) =>
              mutate({ token: stage.token, password }, { onSuccess: () => setDone(true) })
            }
          />
        </>
      );
      break;
  }

  return (
    <AuthLayout brandLabel={brandLabel} legalNote={t('auth.resetPassword.legal')}>
      {content}
    </AuthLayout>
  );
}

type ResetStage = { kind: 'invalid-link' } | { kind: 'done' } | { kind: 'form'; token: string };

/** Which of the screen's three states it is in: no token in the link, reset, or asking. */
function resetStage(token: string | undefined, done: boolean): ResetStage {
  if (!token) return { kind: 'invalid-link' };
  if (done) return { kind: 'done' };
  return { kind: 'form', token };
}
