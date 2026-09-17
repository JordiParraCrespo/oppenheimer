import { AlertDescription, Alert as InlineAlert } from '@oppenheimer/design-system-mobile/alert';
import { Button } from '@oppenheimer/design-system-mobile/button';
import { Text } from '@oppenheimer/design-system-mobile/text';
import {
  useDeploymentCapabilities,
  useLogin,
  useSocialLogin,
} from '@oppenheimer/frontend-core/react';
import { LanguageSwitcher } from '@oppenheimer/frontend-mobile';
import { Link, useRouter } from 'expo-router';
import { Info } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
  Alert as NativeAlert,
  Platform,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthHeader } from '../components/auth-header';
import { LoginForm } from '../forms/login-form';

export function LoginScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const login = useLogin({
    onSuccess: () => {
      router.replace('/(app)');
    },
    onError: (error) => {
      NativeAlert.alert(
        t('auth.login.failedTitle'),
        error.message ?? t('auth.login.invalidCredentials'),
      );
    },
  });

  const social = useSocialLogin({
    onSuccess: () => {
      router.replace('/(app)');
    },
    onError: (error) => {
      NativeAlert.alert(
        t('auth.login.failedTitle'),
        error.message ?? t('auth.login.failedMessage'),
      );
    },
  });

  const { data: capabilityData, error: capabilityError } = useDeploymentCapabilities();
  const capabilities = capabilityError == null ? capabilityData : undefined;
  const googleEnabled = capabilities?.google_oauth ?? true;
  const githubEnabled = capabilities?.github_oauth ?? true;
  const hasSocialProvider = googleEnabled || githubEnabled;

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <SafeAreaView className="flex-1">
        <ScrollView
          contentContainerClassName="min-h-full flex-grow px-6 pb-4 pt-3"
          keyboardShouldPersistTaps="handled"
        >
          <AuthHeader />

          <View className="flex-1 justify-center py-10">
            <Text className="mb-2 text-3xl font-medium text-foreground">
              {t('auth.login.title')}
            </Text>
            <Text className="mb-8 text-base leading-6 text-muted-foreground">
              {t('auth.login.description')}
            </Text>

            <LoginForm
              onSubmit={(values) => login.mutate(values)}
              isPending={login.isPending}
              forgotPasswordLink={
                <Link href="/(auth)/forgot-password" asChild>
                  <Pressable>
                    <Text className="text-sm text-blue-500">{t('auth.login.forgotPassword')}</Text>
                  </Pressable>
                </Link>
              }
            />

            {hasSocialProvider ? (
              <View className="mt-6 gap-3">
                <View className="flex-row items-center gap-3">
                  <View className="h-px flex-1 bg-border" />
                  <Text className="text-xs uppercase text-muted-foreground">
                    {t('common.orContinueWith')}
                  </Text>
                  <View className="h-px flex-1 bg-border" />
                </View>
                <View className="flex-row gap-3">
                  {googleEnabled ? (
                    <Button
                      variant="outline"
                      className="flex-1"
                      disabled={social.isPending}
                      onPress={() => social.mutate({ provider: 'google' })}
                    >
                      <Text>{t('common.google')}</Text>
                    </Button>
                  ) : null}
                  {githubEnabled ? (
                    <Button
                      variant="outline"
                      className="flex-1"
                      disabled={social.isPending}
                      onPress={() => social.mutate({ provider: 'github' })}
                    >
                      <Text>{t('common.github')}</Text>
                    </Button>
                  ) : null}
                </View>
              </View>
            ) : (
              <InlineAlert icon={Info} className="mt-6">
                <AlertDescription>{t('auth.login.noSocialProviders')}</AlertDescription>
              </InlineAlert>
            )}
          </View>

          <LanguageSwitcher />
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}
