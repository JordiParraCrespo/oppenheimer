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
import type { AdminUserEntity, RoleEntity } from '@oppenheimer/frontend';
import {
  useAdminUsers,
  useAssignAdminUserRoles,
  useBanAdminUser,
  useCreateAdminUser,
  useRevokeAdminUserSessions,
  useRoles,
  useUnbanAdminUser,
  useUsersRoles,
} from '@oppenheimer/frontend/react';
import {
  type AdminAssignRolesDto,
  type AdminCreateUserDto,
  adminAssignRolesSchema,
  adminCreateUserSchema,
} from '@oppenheimer/shared/schemas/admin';
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

export default function UsersScreen() {
  const { t } = useTranslation();
  const users = useAdminUsers({ limit: 100, sortBy: 'createdAt', sortDirection: 'desc' });
  const roles = useRoles({ page: 1, limit: 100 });
  const rows = users.data?.data ?? [];
  const roleQueries = useUsersRoles(rows.map((user) => user.id));
  const [createOpen, setCreateOpen] = useState(false);
  const [roleUser, setRoleUser] = useState<AdminUserEntity | null>(null);
  const ban = useBanAdminUser();
  const unban = useUnbanAdminUser();
  const revoke = useRevokeAdminUserSessions();

  function changeStatus(user: AdminUserEntity) {
    Alert.alert(
      t(user.banned ? 'control.users.confirm.unban.title' : 'control.users.confirm.ban.title'),
      t(
        user.banned
          ? 'control.users.confirm.unban.description'
          : 'control.users.confirm.ban.description',
        { name: user.name },
      ),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t(
            user.banned ? 'control.users.confirm.unban.submit' : 'control.users.confirm.ban.submit',
          ),
          style: 'destructive',
          onPress: () => (user.banned ? unban.mutate(user.id) : ban.mutate({ id: user.id })),
        },
      ],
    );
  }

  return (
    <>
      <ScrollView
        className="bg-background"
        contentContainerClassName="gap-4 p-5"
        refreshControl={
          <RefreshControl refreshing={users.isFetching} onRefresh={() => users.refetch()} />
        }
      >
        <View className="flex-row items-start justify-between gap-4">
          <View className="flex-1 gap-1">
            <Text className="text-2xl font-semibold text-foreground">
              {t('control.users.title')}
            </Text>
            <Text className="text-sm text-muted-foreground">{t('control.users.description')}</Text>
          </View>
          <Button size="sm" onPress={() => setCreateOpen(true)}>
            <Text>{t('control.users.add')}</Text>
          </Button>
        </View>
        {users.isLoading ? (
          <ActivityIndicator className="mt-12" />
        ) : (
          rows.map((user, index) => {
            const assigned = roleQueries[index]?.data ?? [];
            return (
              <Card key={user.id}>
                <CardHeader className="gap-1">
                  <View className="flex-row items-start justify-between gap-3">
                    <View className="flex-1">
                      <CardTitle>{user.name}</CardTitle>
                      <Text className="text-sm text-muted-foreground">{user.email}</Text>
                    </View>
                    <Badge variant={user.banned ? 'destructive' : 'secondary'}>
                      <Text>
                        {t(user.banned ? 'control.users.banned' : 'control.users.active')}
                      </Text>
                    </Badge>
                  </View>
                </CardHeader>
                <CardContent className="gap-4">
                  <View className="flex-row flex-wrap gap-2">
                    {assigned.length ? (
                      assigned.map((role) => (
                        <Badge key={role.id} variant="outline">
                          <Text>{role.name}</Text>
                        </Badge>
                      ))
                    ) : (
                      <Text className="text-sm text-muted-foreground">
                        {t('control.users.noRoles')}
                      </Text>
                    )}
                  </View>
                  <View className="flex-row flex-wrap gap-2">
                    <Button size="sm" variant="outline" onPress={() => setRoleUser(user)}>
                      <Text>{t('control.users.actions.roles')}</Text>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onPress={() =>
                        Alert.alert(
                          t('control.users.confirm.sessions.title'),
                          t('control.users.confirm.sessions.description', { name: user.name }),
                          [
                            { text: t('common.cancel'), style: 'cancel' },
                            {
                              text: t('control.users.confirm.sessions.submit'),
                              onPress: () => revoke.mutate(user.id),
                            },
                          ],
                        )
                      }
                    >
                      <Text>{t('control.users.actions.sessions')}</Text>
                    </Button>
                    {!user.isSuperAdmin && (
                      <Button
                        size="sm"
                        variant={user.banned ? 'outline' : 'destructive'}
                        onPress={() => changeStatus(user)}
                      >
                        <Text>
                          {t(
                            user.banned
                              ? 'control.users.actions.unban'
                              : 'control.users.actions.ban',
                          )}
                        </Text>
                      </Button>
                    )}
                  </View>
                </CardContent>
              </Card>
            );
          })
        )}
      </ScrollView>
      <CreateUserDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      {roleUser && (
        <RolesDialog
          key={roleUser.id}
          user={roleUser}
          roles={roles.data?.data ?? []}
          assigned={roleQueries[rows.findIndex((row) => row.id === roleUser.id)]?.data ?? []}
          onClose={() => setRoleUser(null)}
        />
      )}
    </>
  );
}

function CreateUserDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const create = useCreateAdminUser();
  const { control, handleSubmit } = useForm<AdminCreateUserDto>({
    resolver: useZodResolver(adminCreateUserSchema),
    defaultValues: { name: '', email: '', password: '', role: 'user' },
  });
  const submit = handleSubmit(async (values) => {
    try {
      await create.mutateAsync({ ...values, password: values.password || undefined, role: 'user' });
      onClose();
    } catch {
      /* Request error is shown below. */
    }
  });
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('control.users.create.title')}</DialogTitle>
          <DialogDescription>{t('control.users.create.description')}</DialogDescription>
        </DialogHeader>
        <View className="gap-4">
          {create.error && <Text className="text-sm text-destructive">{create.error.message}</Text>}
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
          <Button variant="outline" onPress={onClose}>
            <Text>{t('common.cancel')}</Text>
          </Button>
          <Button onPress={submit} disabled={create.isPending}>
            <Text>{t('control.users.create.submit')}</Text>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RolesDialog({
  user,
  roles,
  assigned,
  onClose,
}: {
  user: AdminUserEntity;
  roles: RoleEntity[];
  assigned: RoleEntity[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const assign = useAssignAdminUserRoles();
  const { control, handleSubmit } = useForm<AdminAssignRolesDto>({
    resolver: useZodResolver(adminAssignRolesSchema),
    defaultValues: { roleIds: assigned.map((role) => role.id) },
  });
  const submit = handleSubmit(async ({ roleIds }) => {
    try {
      await assign.mutateAsync({ userId: user.id, roleIds });
      onClose();
    } catch {
      /* Request error is shown below. */
    }
  });
  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('control.users.roles.title')}</DialogTitle>
          <DialogDescription>
            {t('control.users.roles.description', { name: user.name })}
          </DialogDescription>
        </DialogHeader>
        {assign.error && <Text className="text-sm text-destructive">{assign.error.message}</Text>}
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
          <Button variant="outline" onPress={onClose}>
            <Text>{t('common.cancel')}</Text>
          </Button>
          <Button onPress={submit} disabled={assign.isPending}>
            <Text>{t('common.save')}</Text>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
