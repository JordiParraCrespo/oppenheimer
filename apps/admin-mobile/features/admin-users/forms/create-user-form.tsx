import { Button } from '@oppenheimer/design-system-mobile/button';
import { DialogFooter } from '@oppenheimer/design-system-mobile/dialog';
import { Input } from '@oppenheimer/design-system-mobile/input';
import { Text } from '@oppenheimer/design-system-mobile/text';
import { FormField, useZodResolver } from '@oppenheimer/frontend-mobile';
import { type AdminCreateUserDto, adminCreateUserSchema } from '@oppenheimer/shared/schemas/admin';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

interface CreateUserFormProps {
  onSubmit: (values: AdminCreateUserDto) => Promise<void>;
  onCancel: () => void;
  isPending: boolean;
  error: Error | null;
}

export function CreateUserForm({ onSubmit, onCancel, isPending, error }: CreateUserFormProps) {
  const { t } = useTranslation();
  const { control, handleSubmit } = useForm<AdminCreateUserDto>({
    resolver: useZodResolver(adminCreateUserSchema),
    defaultValues: { name: '', email: '', password: '', role: 'user' },
  });
  const submit = handleSubmit((values) => onSubmit(values));
  return (
    <>
      <View className="gap-4">
        {error && <Text className="text-sm text-destructive">{error.message}</Text>}
        <Controller
          control={control}
          name="name"
          render={({ field, fieldState }) => (
            <FormField
              label={t('control.users.columns.name')}
              nativeID="create-name"
              error={fieldState.error?.message}
            >
              <Input
                aria-labelledby="create-name"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
              />
            </FormField>
          )}
        />
        <Controller
          control={control}
          name="email"
          render={({ field, fieldState }) => (
            <FormField
              label={t('control.users.columns.email')}
              nativeID="create-email"
              error={fieldState.error?.message}
            >
              <Input
                aria-labelledby="create-email"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </FormField>
          )}
        />
        <Controller
          control={control}
          name="password"
          render={({ field, fieldState }) => (
            <FormField
              label={t('control.users.create.password')}
              nativeID="create-password"
              error={fieldState.error?.message}
            >
              <Input
                aria-labelledby="create-password"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                secureTextEntry
              />
            </FormField>
          )}
        />
      </View>
      <DialogFooter>
        <Button variant="outline" onPress={onCancel}>
          <Text>{t('common.cancel')}</Text>
        </Button>
        <Button onPress={submit} disabled={isPending}>
          <Text>{t('control.users.create.submit')}</Text>
        </Button>
      </DialogFooter>
    </>
  );
}
