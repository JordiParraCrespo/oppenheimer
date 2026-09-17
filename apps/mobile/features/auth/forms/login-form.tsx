import { Button } from '@oppenheimer/design-system-mobile/button';
import { Checkbox } from '@oppenheimer/design-system-mobile/checkbox';
import { Input } from '@oppenheimer/design-system-mobile/input';
import { Text } from '@oppenheimer/design-system-mobile/text';
import { FormField, useZodResolver } from '@oppenheimer/frontend-mobile';
import { type LoginDto, loginSchema } from '@oppenheimer/shared';
import { type ReactNode, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

interface LoginFormProps {
  onSubmit: (values: LoginDto) => void;
  isPending: boolean;
  /** The "forgot password" link, rendered next to the keep-signed-in toggle. */
  forgotPasswordLink: ReactNode;
}

export function LoginForm({ onSubmit, isPending, forgotPasswordLink }: LoginFormProps) {
  const { t } = useTranslation();
  const [keepSignedIn, setKeepSignedIn] = useState(true);

  const { control, handleSubmit } = useForm<LoginDto>({
    resolver: useZodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const submit = handleSubmit((values) => onSubmit(values));

  return (
    <View className="gap-4">
      <Controller
        control={control}
        name="email"
        render={({ field, fieldState }) => (
          <FormField label={t('auth.email')} nativeID="email" error={fieldState.error?.message}>
            <Input
              className="h-12 rounded-xl px-4 text-base"
              placeholder={t('auth.emailPlaceholder')}
              aria-labelledby="email"
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
      <Controller
        control={control}
        name="password"
        render={({ field, fieldState }) => (
          <FormField
            label={t('auth.password')}
            nativeID="password"
            error={fieldState.error?.message}
          >
            <Input
              className="h-12 rounded-xl px-4 text-base"
              placeholder={t('auth.passwordPlaceholder')}
              aria-labelledby="password"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              secureTextEntry
              autoComplete="password"
              textContentType="password"
            />
          </FormField>
        )}
      />

      <View className="mb-2 flex-row items-center justify-between">
        <Pressable
          className="flex-row items-center gap-2.5"
          onPress={() => setKeepSignedIn((value) => !value)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: keepSignedIn }}
        >
          <Checkbox
            checked={keepSignedIn}
            onCheckedChange={(checked) => setKeepSignedIn(checked === true)}
            disabled={isPending}
            className="size-5"
          />
          <Text className="text-sm text-muted-foreground">{t('auth.login.keepSignedIn')}</Text>
        </Pressable>
        {forgotPasswordLink}
      </View>

      <Button onPress={submit} disabled={isPending} className="h-12 w-full">
        <Text>{isPending ? t('auth.login.submitting') : t('auth.login.submit')}</Text>
      </Button>
    </View>
  );
}
