import { Button } from '@oppenheimer/design-system-mobile/button';
import { Input } from '@oppenheimer/design-system-mobile/input';
import { Text } from '@oppenheimer/design-system-mobile/text';
import { FormField, useZodResolver } from '@oppenheimer/frontend-mobile';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { type NewPasswordValues, newPasswordSchema } from '../lib/reset-password';

interface ResetPasswordFormProps {
  onSubmit: (values: NewPasswordValues) => void;
  isPending: boolean;
}

export function ResetPasswordForm({ onSubmit, isPending }: ResetPasswordFormProps) {
  const { t } = useTranslation();

  const { control, handleSubmit } = useForm<NewPasswordValues>({
    resolver: useZodResolver(newPasswordSchema),
    defaultValues: { password: '' },
  });

  const submit = handleSubmit((values) => onSubmit(values));

  return (
    <View className="gap-4">
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
      <Button onPress={submit} disabled={isPending} className="mt-2">
        <Text>
          {isPending ? t('auth.resetPassword.submitting') : t('auth.resetPassword.submit')}
        </Text>
      </Button>
    </View>
  );
}
