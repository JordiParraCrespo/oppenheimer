import { Button } from '@oppenheimer/design-system-mobile/button';
import { Icon } from '@oppenheimer/design-system-mobile/icon';
import { ShieldCheck } from '@oppenheimer/design-system-mobile/icons';
import { Text } from '@oppenheimer/design-system-mobile/text';
import { useRegister } from '@oppenheimer/frontend-consumer/react';
import { useErrorMessage } from '@oppenheimer/frontend-core/react';
import {
  AuthFooterNote,
  AuthIconCircle,
  AuthLayout,
  AuthLink,
  AuthSubtitle,
  AuthTitle,
  authControlClass,
  SocialLoginButtons,
} from '@oppenheimer/frontend-mobile';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable } from 'react-native';
import { RegisterForm } from '../forms/register-form';

export function RegisterScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const resolveError = useErrorMessage();
  const { mutate, isPending, error } = useRegister();
  const [registered, setRegistered] = useState(false);

  if (registered) {
    return (
      <AuthLayout>
        <AuthIconCircle>
          <Icon as={ShieldCheck} size={24} />
        </AuthIconCircle>
        <AuthTitle>{t('auth.register.successTitle')}</AuthTitle>
        <AuthSubtitle>{t('auth.register.successMessage')}</AuthSubtitle>
        <Link href="/(auth)/login" asChild>
          <Button className={authControlClass}>
            <Text>{t('auth.register.signIn')}</Text>
          </Button>
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <AuthTitle>{t('auth.register.title')}</AuthTitle>
      <AuthSubtitle>{t('auth.register.description')}</AuthSubtitle>

      <RegisterForm
        isPending={isPending}
        error={error ? resolveError(error, t('auth.register.failed')).message : undefined}
        onSubmit={(values) => mutate(values, { onSuccess: () => setRegistered(true) })}
      />

      {/* The one place a provider identity may become an account: these pass
          `sign-up`, which is what lifts the API's refusal. Without them the
          person the login screen sent here has no way to finish with the
          provider they started with. */}
      <SocialLoginButtons
        disabled={isPending}
        intent="sign-up"
        onSuccess={() => router.replace('/(app)')}
      />

      <AuthFooterNote>
        <Text className="text-sm text-ink-600">{t('auth.register.hasAccount')}</Text>
        <Link href="/(auth)/login" asChild>
          <Pressable>
            <AuthLink>{t('auth.register.signIn')}</AuthLink>
          </Pressable>
        </Link>
      </AuthFooterNote>
    </AuthLayout>
  );
}
