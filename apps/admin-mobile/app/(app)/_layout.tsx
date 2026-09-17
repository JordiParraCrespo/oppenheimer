import { Button } from '@oppenheimer/design-system-mobile/button';
import { Icon } from '@oppenheimer/design-system-mobile/icon';
import { Shield, Users } from '@oppenheimer/design-system-mobile/icons';
import { Text } from '@oppenheimer/design-system-mobile/text';
import { useLogout, useProfile } from '@oppenheimer/frontend-core/react';
import { Redirect, Tabs, useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';

export default function AppLayout() {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const { data: user, isLoading } = useProfile();
  const router = useRouter();
  const logout = useLogout({ onSuccess: () => router.replace('/(auth)/login') });
  const isDark = colorScheme === 'dark';

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" />
      </View>
    );
  }
  if (!user) return <Redirect href="/(auth)/login" />;
  if (!user.canAccessControlPlane) {
    return (
      <View className="flex-1 items-center justify-center gap-4 bg-background p-8">
        <Icon as={Shield} size={42} className="text-muted-foreground" />
        <Text className="text-center text-xl font-semibold text-foreground">
          {t('control.accessDeniedTitle')}
        </Text>
        <Text className="text-center text-muted-foreground">
          {t('control.accessDeniedDescription')}
        </Text>
        <Button variant="outline" onPress={() => logout.mutate()} disabled={logout.isPending}>
          <Text>{t('nav.logOut')}</Text>
        </Button>
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: isDark ? 'hsl(0 0% 3.9%)' : 'hsl(0 0% 100%)' },
        headerTintColor: isDark ? 'hsl(0 0% 98%)' : 'hsl(0 0% 3.9%)',
        sceneStyle: { backgroundColor: isDark ? 'hsl(0 0% 3.9%)' : 'hsl(0 0% 100%)' },
        tabBarActiveTintColor: isDark ? '#fafafa' : '#171717',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('nav.users'),
          headerTitle: 'Oppenheimer Control',
          tabBarIcon: ({ color }) => <Icon as={Users} color={color} size={20} />,
        }}
      />
      <Tabs.Screen
        name="roles"
        options={{
          title: t('nav.roles'),
          tabBarIcon: ({ color }) => <Icon as={Shield} color={color} size={20} />,
        }}
      />
    </Tabs>
  );
}
