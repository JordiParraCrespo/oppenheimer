import { Badge } from '@oppenheimer/design-system-mobile/badge';
import { Button } from '@oppenheimer/design-system-mobile/button';
import { Card, CardContent, CardHeader, CardTitle } from '@oppenheimer/design-system-mobile/card';
import { Checkbox } from '@oppenheimer/design-system-mobile/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@oppenheimer/design-system-mobile/dialog';
import { Input } from '@oppenheimer/design-system-mobile/input';
import { Text } from '@oppenheimer/design-system-mobile/text';
import type { RoleEntity } from '@oppenheimer/frontend';
import {
  useAuthorizationCatalog,
  useCreateRole,
  useDeleteRole,
  useRoles,
  useUpdateRole,
} from '@oppenheimer/frontend/react';
import { type RoleEditorDto, roleEditorSchema } from '@oppenheimer/shared/schemas/role';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from 'react-native';
import { FormField } from '../../components/form-field';
import { useZodResolver } from '../../lib/use-zod-resolver';

export default function RolesScreen() {
  const { t } = useTranslation();
  const roles = useRoles({ page: 1, limit: 100 });
  const remove = useDeleteRole();
  const [editor, setEditor] = useState<RoleEntity | 'new' | null>(null);

  function deleteRole(role: RoleEntity) {
    Alert.alert(
      t('pages.team.confirm.deleteRoleTitle'),
      t('pages.team.confirm.deleteRoleDescription'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.delete'), style: 'destructive', onPress: () => remove.mutate(role.id) },
      ],
    );
  }

  return (
    <>
      <ScrollView
        className="bg-background"
        contentContainerClassName="gap-4 p-5"
        refreshControl={
          <RefreshControl refreshing={roles.isFetching} onRefresh={() => roles.refetch()} />
        }
      >
        <View className="flex-row items-start justify-between gap-4">
          <View className="flex-1 gap-1">
            <Text className="text-2xl font-semibold text-foreground">
              {t('control.roles.title')}
            </Text>
            <Text className="text-sm text-muted-foreground">{t('control.roles.description')}</Text>
          </View>
          <Button size="sm" onPress={() => setEditor('new')}>
            <Text>{t('pages.team.roles.new')}</Text>
          </Button>
        </View>
        {roles.isLoading ? (
          <ActivityIndicator className="mt-12" />
        ) : (
          roles.data?.data.map((role) => (
            <Card key={role.id}>
              <CardHeader>
                <View className="flex-row items-start justify-between gap-3">
                  <View className="flex-1 gap-1">
                    <CardTitle>{role.name}</CardTitle>
                    <Text className="text-sm text-muted-foreground">{role.description || '—'}</Text>
                  </View>
                  <Badge variant="outline">
                    <Text>
                      {t(role.isSystem ? 'pages.team.roles.system' : 'pages.team.roles.custom')}
                    </Text>
                  </Badge>
                </View>
              </CardHeader>
              <CardContent className="gap-3">
                <Text className="text-sm text-muted-foreground">
                  {t('control.roles.permissionCount', { count: role.permissions.length })}
                </Text>
                <View className="flex-row gap-2">
                  <Button size="sm" variant="outline" onPress={() => setEditor(role)}>
                    <Text>{t('common.edit')}</Text>
                  </Button>
                  {!role.isSystem && (
                    <Button size="sm" variant="destructive" onPress={() => deleteRole(role)}>
                      <Text>{t('common.delete')}</Text>
                    </Button>
                  )}
                </View>
              </CardContent>
            </Card>
          ))
        )}
      </ScrollView>
      {editor && (
        <RoleDialog role={editor === 'new' ? undefined : editor} onClose={() => setEditor(null)} />
      )}
    </>
  );
}

function RoleDialog({ role, onClose }: { role?: RoleEntity; onClose: () => void }) {
  const { t } = useTranslation();
  const create = useCreateRole();
  const update = useUpdateRole();
  const catalog = useAuthorizationCatalog();
  const { control, handleSubmit } = useForm<RoleEditorDto>({
    resolver: useZodResolver(roleEditorSchema),
    defaultValues: {
      name: role?.name ?? '',
      description: role?.description ?? '',
      permissions: role?.permissions ?? [],
    },
  });
  const submit = handleSubmit(async (values) => {
    try {
      if (role) {
        await update.mutateAsync({
          id: role.id,
          dto: { description: values.description, permissions: values.permissions },
        });
      } else {
        await create.mutateAsync(values);
      }
      onClose();
    } catch {
      // The request error stays visible in the dialog.
    }
  });
  const error = create.error ?? update.error;

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t(role ? 'pages.team.roleForm.editTitle' : 'pages.team.roleForm.newTitle')}
          </DialogTitle>
          <DialogDescription>{t('pages.team.roleForm.description')}</DialogDescription>
        </DialogHeader>
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
                {catalog.data?.grantable.map((rule) => {
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
          <Button variant="outline" onPress={onClose}>
            <Text>{t('common.cancel')}</Text>
          </Button>
          <Button onPress={submit} disabled={create.isPending || update.isPending}>
            <Text>{t(role ? 'pages.team.roleForm.save' : 'pages.team.roleForm.create')}</Text>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
