import { Button } from '@oppenheimer/design-system-mobile/button';
import { Input } from '@oppenheimer/design-system-mobile/input';
import { Text } from '@oppenheimer/design-system-mobile/text';
import { FormField, useZodResolver } from '@oppenheimer/frontend-mobile';
import { type ForgotPasswordDto, forgotPasswordSchema } from '@oppenheimer/shared';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

interface ForgotPasswordFormProps {
  onSubmit: (values: ForgotPasswordDto) => void;
  isPending: boolean;
}

export function ForgotPasswordForm({ onSubmit, isPending }: ForgotPasswordFormProps) {
  const { t } = useTranslation();

  const { control, handleSubmit } = useForm<ForgotPasswordDto>({
    resolver: useZodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const submit = handleSubmit((values) => onSubmit(values));

  return (
    <View className="gap-4">
      <Controller
        control={control}
        name="email"
        render={({ field, fieldState }) => (
          <FormField label={t('auth.email')} nativeID="fp-email" error={fieldState.error?.message}>
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
      <Button onPress={submit} disabled={isPending} className="mt-2">
        <Text>
          {isPending ? t('auth.forgotPassword.submitting') : t('auth.forgotPassword.submit')}
        </Text>
      </Button>
    </View>
  );
}
