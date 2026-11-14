import { Button } from '@oppenheimer/design-system-mobile/button';
import { Input } from '@oppenheimer/design-system-mobile/input';
import { Text } from '@oppenheimer/design-system-mobile/text';
import { type LoginDto, loginSchema } from '@oppenheimer/shared';
import type { ReactNode } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { FormField, useZodResolver } from '../../forms';
import { AuthFormError, authControlClass, authInputClass } from '../components/auth-primitives';
import { PasswordInput } from '../components/password-input';

export interface LoginFormProps {
  onSubmit: (values: LoginDto) => void;
  isPending: boolean;
  error?: string;
  forgotPasswordLink: ReactNode;
}

export function LoginForm({ onSubmit, isPending, error, forgotPasswordLink }: LoginFormProps) {
  const { t } = useTranslation();
  const { control, handleSubmit } = useForm<LoginDto>({
    resolver: useZodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const submit = handleSubmit((values) => onSubmit(values));

  return (
    <View className="gap-4">
      {error ? <AuthFormError>{error}</AuthFormError> : null}
      <Controller
        control={control}
        name="email"
        render={({ field, fieldState }) => (
          <FormField label={t('auth.email')} nativeID="email" error={fieldState.error?.message}>
            <Input
              className={authInputClass}
              placeholder={t('auth.emailPlaceholder')}
              aria-labelledby="email"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              editable={!isPending}
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
            <PasswordInput
              placeholder={t('auth.passwordPlaceholder')}
              aria-labelledby="password"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              editable={!isPending}
              autoComplete="password"
              textContentType="password"
            />
          </FormField>
        )}
      />
      <View className="mb-2 items-end">{forgotPasswordLink}</View>
      <Button onPress={submit} disabled={isPending} className={authControlClass}>
        <Text>{isPending ? t('auth.login.submitting') : t('auth.login.submit')}</Text>
      </Button>
    </View>
  );
}
