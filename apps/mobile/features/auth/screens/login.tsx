import { Text } from '@oppenheimer/design-system-mobile/text';
import { useErrorMessage, useLogin } from '@oppenheimer/frontend-core/react';
import {
  AuthFooterNote,
  AuthLayout,
  AuthLink,
  AuthSubtitle,
  AuthTitle,
  LoginForm,
} from '@oppenheimer/frontend-mobile';
import { Link, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

/** Sign in with an email and a password, one step past the welcome screen. */
export function LoginScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const resolveError = useErrorMessage();
  const { mutate, isPending, error, reset } = useLogin();

  return (
    <AuthLayout
      footer={
        <AuthFooterNote>
          <Text variant="muted">{t('auth.login.noAccount')}</Text>
          <Link href="/(auth)/register" asChild>
            <Pressable>
              <AuthLink>{t('auth.login.signUp')}</AuthLink>
            </Pressable>
          </Link>
        </AuthFooterNote>
      }
    >
      <View className="gap-1.5">
        <AuthTitle>{t('auth.login.emailTitle')}</AuthTitle>
        <AuthSubtitle>{t('auth.login.emailDescription')}</AuthSubtitle>
      </View>

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
        onEdit={reset}
        onSubmit={(values) => mutate(values, { onSuccess: () => router.replace('/(app)') })}
      />
    </AuthLayout>
  );
}
