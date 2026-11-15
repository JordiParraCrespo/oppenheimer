import { Text } from '@oppenheimer/design-system-mobile/text';
import { useRegister } from '@oppenheimer/frontend-consumer/react';
import { useErrorMessage } from '@oppenheimer/frontend-core/react';
import {
  AuthDivider,
  AuthFooterNote,
  AuthLayout,
  AuthLink,
  AuthSubtitle,
  AuthTitle,
  SocialLoginButtons,
} from '@oppenheimer/frontend-mobile';
import { Link, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { RegisterForm } from '../forms/register-form';

/**
 * Create account, as the console makes one: sign-up provisions the account
 * and a workspace in one go, and the next step names the workspace. The
 * providers here are the one place a provider identity may become an
 * account (`intent="sign-up"`).
 */
export function RegisterScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const resolveError = useErrorMessage();
  const { mutate, isPending, error, reset } = useRegister();

  const toWorkspace = () => router.replace('/onboarding/workspace');

  return (
    <AuthLayout
      footer={
        <AuthFooterNote>
          <Text variant="muted">{t('auth.register.hasAccount')}</Text>
          <Link href="/(auth)/login" asChild>
            <Pressable>
              <AuthLink>{t('auth.register.signIn')}</AuthLink>
            </Pressable>
          </Link>
        </AuthFooterNote>
      }
    >
      <View className="gap-1.5">
        <AuthTitle>{t('auth.register.title')}</AuthTitle>
        <AuthSubtitle>{t('auth.register.phoneDescription')}</AuthSubtitle>
      </View>

      <View>
        <SocialLoginButtons
          divider={false}
          intent="sign-up"
          disabled={isPending}
          onSuccess={toWorkspace}
        />
        <AuthDivider label={t('common.or')} />
        <RegisterForm
          isPending={isPending}
          error={error ? resolveError(error, t('auth.register.failed')).message : undefined}
          onEdit={reset}
          onSubmit={(values) => mutate(values, { onSuccess: toWorkspace })}
        />
      </View>
    </AuthLayout>
  );
}
