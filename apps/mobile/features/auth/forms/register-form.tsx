import { Button } from '@oppenheimer/design-system-mobile/button';
import { Input } from '@oppenheimer/design-system-mobile/input';
import { Text } from '@oppenheimer/design-system-mobile/text';
import {
  AuthFormError,
  authControlClass,
  authInputClass,
  FormField,
  PasswordChecklist,
  PasswordInput,
  type PasswordRule,
  useZodResolver,
} from '@oppenheimer/frontend-mobile';
import { type RegisterDto, registerSchema } from '@oppenheimer/shared';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

const RULES: readonly PasswordRule[] = ['length', 'case', 'number'];

interface RegisterFormProps {
  onSubmit: (values: RegisterDto) => void;
  isPending: boolean;
  /** The resolved failure message, if the last attempt failed. */
  error?: string;
}

export function RegisterForm({ onSubmit, isPending, error }: RegisterFormProps) {
  const { t } = useTranslation();

  const { control, handleSubmit } = useForm<RegisterDto>({
    resolver: useZodResolver(registerSchema),
    defaultValues: { firstName: '', lastName: '', email: '', password: '' },
  });

  const submit = handleSubmit((values) => onSubmit(values));

  return (
    <View className="gap-4">
      {error ? <AuthFormError>{error}</AuthFormError> : null}

      <View className="flex-row gap-3">
        <View className="flex-1">
          <Controller
            control={control}
            name="firstName"
            render={({ field, fieldState }) => (
              <FormField
                label={t('auth.firstName')}
                nativeID="firstName"
                error={fieldState.error?.message}
              >
                <Input
                  className={authInputClass}
                  placeholder={t('auth.firstNamePlaceholder')}
                  aria-labelledby="firstName"
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  editable={!isPending}
                  autoComplete="given-name"
                  textContentType="givenName"
                />
              </FormField>
            )}
          />
        </View>
        <View className="flex-1">
          <Controller
            control={control}
            name="lastName"
            render={({ field, fieldState }) => (
              <FormField
                label={t('auth.lastName')}
                nativeID="lastName"
                error={fieldState.error?.message}
              >
                <Input
                  className={authInputClass}
                  placeholder={t('auth.lastNamePlaceholder')}
                  aria-labelledby="lastName"
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  editable={!isPending}
                  autoComplete="family-name"
                  textContentType="familyName"
                />
              </FormField>
            )}
          />
        </View>
      </View>
      <Controller
        control={control}
        name="email"
        render={({ field, fieldState }) => (
          <FormField label={t('auth.email')} nativeID="reg-email" error={fieldState.error?.message}>
            <Input
              className={authInputClass}
              placeholder={t('auth.emailPlaceholder')}
              aria-labelledby="reg-email"
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
            label={t('auth.register.passwordLabel')}
            nativeID="reg-password"
            error={fieldState.error?.message}
          >
            <PasswordInput
              placeholder={t('auth.register.passwordPlaceholder')}
              aria-labelledby="reg-password"
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

      <PasswordChecklist control={control} name="password" rules={RULES} className="mb-1.5">
        {(satisfied) => (
          <Button onPress={submit} disabled={isPending || !satisfied} className={authControlClass}>
            <Text>{isPending ? t('auth.register.submitting') : t('auth.register.submit')}</Text>
          </Button>
        )}
      </PasswordChecklist>
    </View>
  );
}
