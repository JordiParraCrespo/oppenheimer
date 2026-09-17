import { Button } from '@oppenheimer/design-system-mobile/button';
import { Checkbox } from '@oppenheimer/design-system-mobile/checkbox';
import { DialogFooter } from '@oppenheimer/design-system-mobile/dialog';
import { Text } from '@oppenheimer/design-system-mobile/text';
import type { RoleEntity } from '@oppenheimer/frontend-admin';
import { useZodResolver } from '@oppenheimer/frontend-mobile';
import {
  type AdminAssignRolesDto,
  adminAssignRolesSchema,
} from '@oppenheimer/shared/schemas/admin';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

interface AssignRolesFormProps {
  roles: RoleEntity[];
  assigned: RoleEntity[];
  onSubmit: (values: AdminAssignRolesDto) => Promise<void>;
  onCancel: () => void;
  isPending: boolean;
  error: Error | null;
}

export function AssignRolesForm({
  roles,
  assigned,
  onSubmit,
  onCancel,
  isPending,
  error,
}: AssignRolesFormProps) {
  const { t } = useTranslation();
  const { control, handleSubmit } = useForm<AdminAssignRolesDto>({
    resolver: useZodResolver(adminAssignRolesSchema),
    defaultValues: { roleIds: assigned.map((role) => role.id) },
  });
  const submit = handleSubmit((values) => onSubmit(values));
  return (
    <>
      {error && <Text className="text-sm text-destructive">{error.message}</Text>}
      <Controller
        control={control}
        name="roleIds"
        render={({ field }) => (
          <View className="gap-1">
            {roles.map((role) => {
              const checked = field.value.includes(role.id);
              return (
                <Pressable
                  key={role.id}
                  className="flex-row items-center gap-3 rounded-xl border border-border p-3"
                  onPress={() =>
                    field.onChange(
                      checked
                        ? field.value.filter((id) => id !== role.id)
                        : [...field.value, role.id],
                    )
                  }
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() =>
                      field.onChange(
                        checked
                          ? field.value.filter((id) => id !== role.id)
                          : [...field.value, role.id],
                      )
                    }
                  />
                  <View className="flex-1">
                    <Text className="font-medium text-foreground">{role.name}</Text>
                    <Text className="text-xs text-muted-foreground">
                      {role.description || t('control.users.roles.noDescription')}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      />
      <DialogFooter>
        <Button variant="outline" onPress={onCancel}>
          <Text>{t('common.cancel')}</Text>
        </Button>
        <Button onPress={submit} disabled={isPending}>
          <Text>{t('common.save')}</Text>
        </Button>
      </DialogFooter>
    </>
  );
}
