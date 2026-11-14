import { Button } from '@oppenheimer/design-system-mobile/button';
import { Icon } from '@oppenheimer/design-system-mobile/icon';
import { ChevronLeft } from '@oppenheimer/design-system-mobile/icons';
import { Text } from '@oppenheimer/design-system-mobile/text';
import { useErrorMessage, useLogin } from '@oppenheimer/frontend-core/react';
import { AuthLink, LoginForm } from '@oppenheimer/frontend-mobile';
import { Link, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/** Sign in with an email and a password, one step past the welcome screen. */
export function LoginScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const resolveError = useErrorMessage();
  const { mutate, isPending, error } = useLogin();

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <SafeAreaView className="flex-1">
        <ScrollView
          contentContainerClassName="flex-grow gap-6 px-5 pb-4"
          keyboardShouldPersistTaps="handled"
        >
          <View className="-ml-2.5 h-11 justify-center">
            <Button
              variant="ghost"
              size="icon"
              accessibilityLabel={t('auth.login.back')}
              onPress={() =>
                router.canGoBack() ? router.back() : router.replace('/(auth)/welcome')
              }
              className="size-11"
            >
              <Icon as={ChevronLeft} size={22} />
            </Button>
          </View>

          <View className="gap-1.5">
            <Text variant="largeTitle">{t('auth.login.emailTitle')}</Text>
            <Text variant="subhead">{t('auth.login.emailDescription')}</Text>
          </View>

          <LoginForm
            isPending={isPending}
            error={
              error ? resolveError(error, t('auth.login.invalidCredentials')).message : undefined
            }
            forgotPasswordLink={
              <Link href="/(auth)/forgot-password" asChild>
                <Pressable>
                  <AuthLink>{t('auth.login.forgotPassword')}</AuthLink>
                </Pressable>
              </Link>
            }
            onSubmit={(values) => mutate(values, { onSuccess: () => router.replace('/(app)') })}
          />

          <View className="flex-1" />
          <Text variant="muted">{t('auth.login.noAccountMobile')}</Text>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}
