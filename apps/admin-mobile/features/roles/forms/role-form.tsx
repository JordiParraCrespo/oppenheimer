import { Button } from '@oppenheimer/design-system-mobile/button';
import { Checkbox } from '@oppenheimer/design-system-mobile/checkbox';
import { DialogFooter } from '@oppenheimer/design-system-mobile/dialog';
import { Input } from '@oppenheimer/design-system-mobile/input';
import { Text } from '@oppenheimer/design-system-mobile/text';
import type { AuthorizationCatalog, RoleEntity } from '@oppenheimer/frontend-admin';
import { FormField, useZodResolver } from '@oppenheimer/frontend-mobile';
import { type RoleEditorDto, roleEditorSchema } from '@oppenheimer/shared/schemas/role';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';

interface RoleFormProps {
  /** Editing an existing role; absent when creating one. */
  role?: RoleEntity;
  grantable: AuthorizationCatalog['grantable'] | undefined;
  onSubmit: (values: RoleEditorDto) => Promise<void>;
  onCancel: () => void;
  isPending: boolean;
  error: Error | null;
}

export function RoleForm({ role, grantable, onSubmit, onCancel, isPending, error }: RoleFormProps) {
  const { t } = useTranslation();
  const { control, handleSubmit } = useForm<RoleEditorDto>({
    resolver: useZodResolver(roleEditorSchema),
    defaultValues: {
      name: role?.name ?? '',
      description: role?.description ?? '',
      permissions: role?.permissions ?? [],
    },
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
              label={t('pages.team.roleForm.name')}
              nativeID="role-name"
              error={fieldState.error?.message}
            >
              <Input
                aria-labelledby="role-name"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                editable={!role}
              />
            </FormField>
          )}
        />
        <Controller
          control={control}
          name="description"
          render={({ field, fieldState }) => (
            <FormField
              label={t('pages.team.roleForm.details')}
              nativeID="role-description"
              error={fieldState.error?.message}
            >
              <Input
                aria-labelledby="role-description"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
              />
            </FormField>
          )}
        />
        <Controller
          control={control}
          name="permissions"
          render={({ field }) => (
            <ScrollView className="max-h-72" contentContainerClassName="gap-1">
              {grantable?.map((rule) => {
                const key = `${rule.subject}:${rule.action}`;
                const checked = field.value.some(
                  (permission) =>
                    permission.subject === rule.subject && permission.action === rule.action,
                );
                const toggle = () =>
                  field.onChange(
                    checked
                      ? field.value.filter(
                          (permission) =>
                            !(
                              permission.subject === rule.subject &&
                              permission.action === rule.action
                            ),
                        )
                      : [...field.value, { subject: rule.subject, action: rule.action }],
                  );
                return (
                  <Pressable
                    key={key}
                    className="flex-row items-center gap-3 rounded-xl border border-border p-3"
                    onPress={toggle}
                  >
                    <Checkbox checked={checked} onCheckedChange={toggle} />
                    <Text className="flex-1 text-sm text-foreground">
                      {rule.subject} · {rule.action}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        />
      </View>
      <DialogFooter>
        <Button variant="outline" onPress={onCancel}>
          <Text>{t('common.cancel')}</Text>
        </Button>
        <Button onPress={submit} disabled={isPending}>
          <Text>{t(role ? 'pages.team.roleForm.save' : 'pages.team.roleForm.create')}</Text>
        </Button>
      </DialogFooter>
    </>
  );
}
