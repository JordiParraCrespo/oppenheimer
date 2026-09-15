import { Button } from '@oppenheimer/design-system-mobile/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@oppenheimer/design-system-mobile/card';
import { Input } from '@oppenheimer/design-system-mobile/input';
import { Text } from '@oppenheimer/design-system-mobile/text';
import { useForgotPassword } from '@oppenheimer/frontend/react';
import { type ForgotPasswordDto, forgotPasswordSchema } from '@oppenheimer/shared';
import { Link } from 'expo-router';
import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { FormField } from '../../components/form-field';
import { useZodResolver } from '../../lib/use-zod-resolver';

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const [submitted, setSubmitted] = React.useState(false);

  const { control, handleSubmit } = useForm<ForgotPasswordDto>({
    resolver: useZodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const forgotPassword = useForgotPassword({
    onSuccess: () => {
      setSubmitted(true);
    },
    onError: () => {
      setSubmitted(true);
    },
  });

  const onSubmit = handleSubmit(({ email }) => forgotPassword.mutate(email));

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
            <Controller
              control={control}
              name="email"
              render={({ field, fieldState }) => (
                <FormField
                  label={t('auth.email')}
                  nativeID="fp-email"
                  error={fieldState.error?.message}
                >
                  <Input
                    placeholder={t('auth.emailPlaceholder')}
                    aria-labelledby="fp-email"
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
            <Button onPress={onSubmit} disabled={forgotPassword.isPending} className="mt-2">
              <Text>
                {forgotPassword.isPending
                  ? t('auth.forgotPassword.submitting')
                  : t('auth.forgotPassword.submit')}
              </Text>
            </Button>
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
