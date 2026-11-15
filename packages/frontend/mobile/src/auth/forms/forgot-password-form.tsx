import { Button } from '@oppenheimer/design-system-mobile/button';
import { Input } from '@oppenheimer/design-system-mobile/input';
import { Text } from '@oppenheimer/design-system-mobile/text';
import { type ForgotPasswordDto, forgotPasswordSchema } from '@oppenheimer/shared';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { FormField, useZodResolver } from '../../forms';
import { AuthFormError, authControlClass, authInputClass } from '../components/auth-primitives';

export interface ForgotPasswordFormProps {
  onSubmit: (values: ForgotPasswordDto) => void;
  isPending: boolean;
  error?: string;
  /** Called on any edit and on each try, so a failure the server gave clears. */
  onEdit?: () => void;
}

export function ForgotPasswordForm({
  onSubmit,
  isPending,
  error,
  onEdit,
}: ForgotPasswordFormProps) {
  const { t } = useTranslation();
  const { control, handleSubmit } = useForm<ForgotPasswordDto>({
    resolver: useZodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const submit = () => {
    onEdit?.();
    void handleSubmit((values) => onSubmit(values))();
  };
  const edit = (onChange: (value: string) => void) => (value: string) => {
    onChange(value);
    onEdit?.();
  };

  return (
    <View className="gap-4">
      <Controller
        control={control}
        name="email"
        render={({ field, fieldState }) => (
          <FormField label={t('auth.email')} nativeID="fp-email" error={fieldState.error?.message}>
            <Input
              className={authInputClass}
              placeholder={t('auth.emailPlaceholder')}
              aria-labelledby="fp-email"
              value={field.value}
              onChangeText={edit(field.onChange)}
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
      {error ? <AuthFormError>{error}</AuthFormError> : null}
      <Button onPress={submit} disabled={isPending} className={authControlClass}>
        <Text>
          {isPending ? t('auth.forgotPassword.submitting') : t('auth.forgotPassword.submit')}
        </Text>
      </Button>
    </View>
  );
}
