import { Badge } from '@oppenheimer/design-system-mobile/badge';
import { Button } from '@oppenheimer/design-system-mobile/button';
import { Card, CardContent, CardHeader, CardTitle } from '@oppenheimer/design-system-mobile/card';
import { Text } from '@oppenheimer/design-system-mobile/text';
import type { AdminUserEntity } from '@oppenheimer/frontend-admin';
import {
  useAdminUsers,
  useBanAdminUser,
  useRevokeAdminUserSessions,
  useRoles,
  useUnbanAdminUser,
  useUsersRoles,
} from '@oppenheimer/frontend-admin/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, View } from 'react-native';
import { AssignRolesDialog } from '../dialogs/assign-roles';
import { CreateUserDialog } from '../dialogs/create-user';

export function UsersScreen() {
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
        <AssignRolesDialog
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
