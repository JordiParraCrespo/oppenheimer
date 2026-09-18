import { useErrorMessage, useLogin } from '@oppenheimer/frontend-core/react';
import {
  AuthLayout,
  AuthLink,
  AuthSubtitle,
  AuthTitle,
  LoginForm,
  SocialLoginButtons,
} from '@oppenheimer/frontend-mobile';
import { Link, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable } from 'react-native';

export function LoginScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const resolveError = useErrorMessage();
  const { mutate, isPending, error } = useLogin();

  const toApp = () => router.replace('/(app)');

  // No sign-up footer and no `sign-up` intent anywhere on this screen: the
  // control plane has no public registration, so an account here is one an
  // existing platform administrator provisioned.
  return (
    <AuthLayout brandLabel={t('common.controlAppName')}>
      <AuthTitle>{t('auth.login.title')}</AuthTitle>
      <AuthSubtitle>{t('auth.login.description')}</AuthSubtitle>

      <LoginForm
        isPending={isPending}
        error={error ? resolveError(error, t('auth.login.invalidCredentials')).message : undefined}
        forgotPasswordLink={
          <Link href="/(auth)/forgot-password" asChild>
            <Pressable>
              <AuthLink>{t('auth.login.forgotPassword')}</AuthLink>
            </Pressable>
          </Link>
        }
        onSubmit={(values) => mutate(values, { onSuccess: toApp })}
      />

      <SocialLoginButtons disabled={isPending} onSuccess={toApp} />
    </AuthLayout>
  );
}
