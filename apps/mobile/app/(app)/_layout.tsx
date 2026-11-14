import {
  Bot,
  GitPullRequest,
  type LucideIcon,
  Terminal,
  User,
  Zap,
} from '@oppenheimer/design-system-mobile/icons';
import { TabBar } from '@oppenheimer/frontend-mobile';
import { Tabs } from 'expo-router/tabs';
import { useTranslation } from 'react-i18next';

/**
 * The export's sections, in the order its tab bar draws them. `label` is the
 * short name under the icon when the title is too long for it.
 */
const SECTIONS = [
  { name: 'index', title: 'nav.sessions', icon: Terminal },
  { name: 'employees', title: 'nav.employees', icon: Bot },
  {
    name: 'pull-requests',
    title: 'nav.pullRequests',
    label: 'nav.pullRequestsShort',
    icon: GitPullRequest,
  },
  { name: 'automations', title: 'nav.automations', icon: Zap },
  { name: 'account', title: 'nav.account', icon: User },
] as const satisfies readonly {
  name: string;
  title: `nav.${string}`;
  label?: `nav.${string}`;
  icon: LucideIcon;
}[];

/** The signed-in app: five sections behind the export's floating tab bar. */
export default function AppLayout() {
  const { t } = useTranslation();

  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      {SECTIONS.map((section) => {
        const Glyph = section.icon;
        return (
          <Tabs.Screen
            key={section.name}
            name={section.name}
            options={{
              title: t(section.title),
              tabBarLabel: 'label' in section ? t(section.label) : undefined,
              tabBarIcon: ({ color, size }) => <Glyph color={color} size={size} />,
            }}
          />
        );
      })}
    </Tabs>
  );
}
