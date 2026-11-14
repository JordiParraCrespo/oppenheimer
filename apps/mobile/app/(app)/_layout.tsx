import { Bot, GitPullRequest, Terminal, User, Zap } from '@oppenheimer/design-system-mobile/icons';
import { TabBar } from '@oppenheimer/frontend-mobile';
import { Tabs } from 'expo-router/tabs';
import { useTranslation } from 'react-i18next';

/** The signed-in app: five sections behind the export's floating tab bar. */
export default function AppLayout() {
  const { t } = useTranslation();

  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen
        name="index"
        options={{
          title: t('nav.sessions'),
          tabBarIcon: ({ color, size }) => <Terminal color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="employees"
        options={{
          title: t('nav.employees'),
          tabBarIcon: ({ color, size }) => <Bot color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="pull-requests"
        options={{
          title: t('nav.pullRequests'),
          tabBarLabel: t('nav.pullRequestsShort'),
          tabBarIcon: ({ color, size }) => <GitPullRequest color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="automations"
        options={{
          title: t('nav.automations'),
          tabBarIcon: ({ color, size }) => <Zap color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: t('nav.account'),
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
