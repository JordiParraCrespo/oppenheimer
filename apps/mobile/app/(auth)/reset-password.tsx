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
import { useResetPassword } from '@oppenheimer/frontend/react';
import { resetPasswordSchema } from '@oppenheimer/shared';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import type { z } from 'zod';
import { FormField } from '../../components/form-field';
import { useZodResolver } from '../../lib/use-zod-resolver';

/** The token arrives in the deep link, so only the password is user input. */
const newPasswordSchema = resetPasswordSchema.pick({ password: true });

type NewPasswordValues = z.infer<typeof newPasswordSchema>;

export default function ResetPasswordScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token?: string }>();

  const { control, handleSubmit } = useForm<NewPasswordValues>({
    resolver: useZodResolver(newPasswordSchema),
    defaultValues: { password: '' },
  });

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

  const onSubmit = handleSubmit(({ password }) => {
    if (!token) return;
    reset.mutate({ token, password });
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
            <Controller
              control={control}
              name="password"
              render={({ field, fieldState }) => (
                <FormField
                  label={t('auth.resetPassword.newPassword')}
                  nativeID="rp-password"
                  error={fieldState.error?.message}
                >
                  <Input
                    placeholder={t('auth.resetPassword.newPasswordPlaceholder')}
                    aria-labelledby="rp-password"
                    value={field.value}
                    onChangeText={field.onChange}
                    onBlur={field.onBlur}
                    secureTextEntry
                    autoComplete="new-password"
                    textContentType="newPassword"
                  />
                </FormField>
              )}
            />
            <Button onPress={onSubmit} disabled={reset.isPending} className="mt-2">
              <Text>
                {reset.isPending
                  ? t('auth.resetPassword.submitting')
                  : t('auth.resetPassword.submit')}
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
