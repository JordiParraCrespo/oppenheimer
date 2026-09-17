import { Button } from '@oppenheimer/design-system-mobile/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@oppenheimer/design-system-mobile/card';
import { Text } from '@oppenheimer/design-system-mobile/text';
import { useForgotPassword } from '@oppenheimer/frontend-core/react';
import { Link } from 'expo-router';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { ForgotPasswordForm } from '../forms/forgot-password-form';

export function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const [submitted, setSubmitted] = React.useState(false);

  const forgotPassword = useForgotPassword({
    onSuccess: () => {
      setSubmitted(true);
    },
    onError: () => {
      setSubmitted(true);
    },
  });

  if (submitted) {
    return (
      <ScrollView contentContainerClassName="flex-grow justify-center p-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('auth.forgotPassword.successTitle')}</CardTitle>
            <CardDescription>{t('auth.forgotPassword.successMessage')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/(auth)/login" asChild>
              <Button variant="outline">
                <Text>{t('auth.forgotPassword.backToSignIn')}</Text>
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
            <CardTitle>{t('auth.forgotPassword.title')}</CardTitle>
            <CardDescription>{t('auth.forgotPassword.description')}</CardDescription>
          </CardHeader>
          <CardContent className="gap-4">
            <ForgotPasswordForm
              onSubmit={({ email }) => forgotPassword.mutate(email)}
              isPending={forgotPassword.isPending}
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
