import { Badge } from '@oppenheimer/design-system-mobile/badge';
import { Button } from '@oppenheimer/design-system-mobile/button';
import { Card, CardContent, CardHeader, CardTitle } from '@oppenheimer/design-system-mobile/card';
import { Text } from '@oppenheimer/design-system-mobile/text';
import type { RoleEntity } from '@oppenheimer/frontend-admin';
import { useDeleteRole, useRoles } from '@oppenheimer/frontend-admin/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, View } from 'react-native';
import { RoleEditorDialog } from '../dialogs/role-editor';

export function RolesScreen() {
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
        <RoleEditorDialog
          role={editor === 'new' ? undefined : editor}
          onClose={() => setEditor(null)}
        />
      )}
    </>
  );
}
