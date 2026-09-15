import { AlertDescription, Alert as InlineAlert } from '@oppenheimer/design-system-mobile/alert';
import { Button } from '@oppenheimer/design-system-mobile/button';
import { Checkbox } from '@oppenheimer/design-system-mobile/checkbox';
import { Icon } from '@oppenheimer/design-system-mobile/icon';
import { Input } from '@oppenheimer/design-system-mobile/input';
import { Text } from '@oppenheimer/design-system-mobile/text';
import { useDeploymentCapabilities, useLogin, useSocialLogin } from '@oppenheimer/frontend/react';
import { type LoginDto, loginSchema } from '@oppenheimer/shared';
import { Link, useRouter } from 'expo-router';
import { Asterisk, Info, Moon, Sun } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
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
import { FormField } from '../../components/form-field';
import { LanguageSwitcher } from '../../components/language-switcher';
import { useZodResolver } from '../../lib/use-zod-resolver';

export default function LoginScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [keepSignedIn, setKeepSignedIn] = useState(true);

  const { control, handleSubmit } = useForm<LoginDto>({
    resolver: useZodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

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
  const onSubmit = handleSubmit((values) => login.mutate(values));

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

            <View className="gap-4">
              <Controller
                control={control}
                name="email"
                render={({ field, fieldState }) => (
                  <FormField
                    label={t('auth.email')}
                    nativeID="email"
                    error={fieldState.error?.message}
                  >
                    <Input
                      className="h-12 rounded-xl px-4 text-base"
                      placeholder={t('auth.emailPlaceholder')}
                      aria-labelledby="email"
                      value={field.value}
                      onChangeText={field.onChange}
                      onBlur={field.onBlur}
                      autoCapitalize="none"
                      autoComplete="email"
                      keyboardType="email-address"
                      textContentType="emailAddress"
                    />
                  </FormField>
                )}
              />
              <Controller
                control={control}
                name="password"
                render={({ field, fieldState }) => (
                  <FormField
                    label={t('auth.password')}
                    nativeID="password"
                    error={fieldState.error?.message}
                  >
                    <Input
                      className="h-12 rounded-xl px-4 text-base"
                      placeholder={t('auth.passwordPlaceholder')}
                      aria-labelledby="password"
                      value={field.value}
                      onChangeText={field.onChange}
                      onBlur={field.onBlur}
                      secureTextEntry
                      autoComplete="password"
                      textContentType="password"
                    />
                  </FormField>
                )}
              />

              <View className="mb-2 flex-row items-center justify-between">
                <Pressable
                  className="flex-row items-center gap-2.5"
                  onPress={() => setKeepSignedIn((value) => !value)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: keepSignedIn }}
                >
                  <Checkbox
                    checked={keepSignedIn}
                    onCheckedChange={(checked) => setKeepSignedIn(checked === true)}
                    disabled={login.isPending}
                    className="size-5"
                  />
                  <Text className="text-sm text-muted-foreground">
                    {t('auth.login.keepSignedIn')}
                  </Text>
                </Pressable>
                <Link href="/(auth)/forgot-password" asChild>
                  <Pressable>
                    <Text className="text-sm text-blue-500">{t('auth.login.forgotPassword')}</Text>
                  </Pressable>
                </Link>
              </View>

              <Button onPress={onSubmit} disabled={login.isPending} className="h-12 w-full">
                <Text>{login.isPending ? t('auth.login.submitting') : t('auth.login.submit')}</Text>
              </Button>
            </View>

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
                      onPress={() => social.mutate({ provider: 'google' } as never)}
                    >
                      <Text>{t('common.google')}</Text>
                    </Button>
                  ) : null}
                  {githubEnabled ? (
                    <Button
                      variant="outline"
                      className="flex-1"
                      disabled={social.isPending}
                      onPress={() => social.mutate({ provider: 'github' } as never)}
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

            <View className="mt-6 flex-row items-center justify-center gap-1">
              <Text className="text-sm text-muted-foreground">{t('auth.login.noAccount')}</Text>
              <Link href="/(auth)/register" asChild>
                <Pressable>
                  <Text className="text-sm font-medium text-blue-500">
                    {t('auth.login.signUp')}
                  </Text>
                </Pressable>
              </Link>
            </View>
          </View>

          <LanguageSwitcher />
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

function AuthHeader() {
  const { t } = useTranslation();
  const { colorScheme, toggleColorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View className="flex-row items-center justify-between">
      <View className="flex-row items-center gap-3">
        <Icon as={Asterisk} size={34} strokeWidth={2.5} className="text-foreground" />
        <Text className="text-xl font-medium text-foreground">{t('common.appName')}</Text>
      </View>
      <Pressable
        onPress={toggleColorScheme}
        accessibilityRole="switch"
        accessibilityState={{ checked: isDark }}
        accessibilityLabel={t('theme.toggle')}
        className="h-9 w-[72px] flex-row rounded-full border border-border bg-card p-1"
      >
        <View
          className={
            isDark
              ? 'flex-1 items-center justify-center'
              : 'flex-1 items-center justify-center rounded-full bg-muted'
          }
        >
          <Icon as={Sun} size={17} className="text-muted-foreground" />
        </View>
        <View
          className={
            isDark
              ? 'flex-1 items-center justify-center rounded-full bg-muted'
              : 'flex-1 items-center justify-center'
          }
        >
          <Icon as={Moon} size={17} className="text-muted-foreground" />
        </View>
      </Pressable>
    </View>
  );
}
