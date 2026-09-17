import { Button } from '@oppenheimer/design-system-mobile/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@oppenheimer/design-system-mobile/card';
import { Text } from '@oppenheimer/design-system-mobile/text';
import { useResetPassword } from '@oppenheimer/frontend-core/react';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { ResetPasswordForm } from '../forms/reset-password-form';

export function ResetPasswordScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token?: string }>();

  const reset = useResetPassword({
    onSuccess: () => {
      Alert.alert(t('auth.resetPassword.successTitle'), t('auth.resetPassword.successMessage'), [
        { text: 'OK', onPress: () => router.replace('/(auth)/login') },
      ]);
    },
    onError: (error) => {
      Alert.alert(
        t('auth.resetPassword.failedTitle'),
        error.message ?? t('auth.resetPassword.error'),
      );
    },
  });

  if (!token) {
    return (
      <ScrollView contentContainerClassName="flex-grow justify-center p-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('auth.resetPassword.invalidTitle')}</CardTitle>
            <CardDescription>{t('auth.resetPassword.invalidMessage')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/(auth)/forgot-password" asChild>
              <Button variant="outline">
                <Text>{t('auth.resetPassword.requestNewLink')}</Text>
              </Button>
            </Link>
          </CardContent>
        </Card>
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerClassName="flex-grow justify-center p-6"
        keyboardShouldPersistTaps="handled"
      >
        <Card>
          <CardHeader>
            <CardTitle>{t('auth.resetPassword.title')}</CardTitle>
            <CardDescription>{t('auth.resetPassword.description')}</CardDescription>
          </CardHeader>
          <CardContent className="gap-4">
            <ResetPasswordForm
              onSubmit={({ password }) => {
                if (!token) return;
                reset.mutate({ token, password });
              }}
              isPending={reset.isPending}
            />
            <Link href="/(auth)/login" asChild>
              <Button variant="link" size="sm">
                <Text>{t('auth.forgotPassword.backToSignIn')}</Text>
              </Button>
            </Link>
          </CardContent>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
