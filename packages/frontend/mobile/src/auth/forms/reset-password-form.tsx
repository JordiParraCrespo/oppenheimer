import { Button } from '@oppenheimer/design-system-mobile/button';
import { Text } from '@oppenheimer/design-system-mobile/text';
import { cn } from '@oppenheimer/design-system-mobile/utils';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { FormField, useZodResolver } from '../../forms';
import { AuthFormError, authControlClass } from '../components/auth-primitives';
import { PasswordInput } from '../components/password-input';
import { type NewPasswordValues, newPasswordSchema } from '../lib/new-password-schema';

export interface ResetPasswordFormProps {
  onSubmit: (values: NewPasswordValues) => void;
  isPending: boolean;
  error?: string;
}

export function ResetPasswordForm({ onSubmit, isPending, error }: ResetPasswordFormProps) {
  const { t } = useTranslation();
  const { control, handleSubmit } = useForm<NewPasswordValues>({
    resolver: useZodResolver(newPasswordSchema(t('auth.passwordsDoNotMatch'))),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const submit = handleSubmit((values) => onSubmit(values));

  return (
    <View className="gap-4">
      {error ? <AuthFormError>{error}</AuthFormError> : null}
      <Controller
        control={control}
        name="password"
        render={({ field, fieldState }) => (
          <FormField
            label={t('auth.resetPassword.newPassword')}
            nativeID="rp-password"
            error={fieldState.error?.message}
          >
            <PasswordInput
              placeholder={t('auth.resetPassword.newPasswordPlaceholder')}
              aria-labelledby="rp-password"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              editable={!isPending}
              autoComplete="new-password"
              textContentType="newPassword"
            />
          </FormField>
        )}
      />
      <Controller
        control={control}
        name="confirmPassword"
        render={({ field, fieldState }) => (
          <FormField
            label={t('auth.resetPassword.confirmPassword')}
            nativeID="rp-confirm"
            error={fieldState.error?.message}
          >
            <PasswordInput
              placeholder={t('auth.resetPassword.confirmPasswordPlaceholder')}
              aria-labelledby="rp-confirm"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              editable={!isPending}
              autoComplete="new-password"
              textContentType="newPassword"
            />
          </FormField>
        )}
      />
      <Button onPress={submit} disabled={isPending} className={cn(authControlClass, 'mt-2')}>
        <Text>
          {isPending ? t('auth.resetPassword.submitting') : t('auth.resetPassword.submit')}
        </Text>
      </Button>
    </View>
  );
}
