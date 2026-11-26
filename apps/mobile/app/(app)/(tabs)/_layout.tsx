import { TAB_BAR, THEME } from '@oppenheimer/frontend-mobile';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useColorScheme } from 'nativewind';
import { useTranslation } from 'react-i18next';
import { Platform } from 'react-native';

/**
 * The console rail's sections, in its order: Sessions, Plan, Employees,
 * Automations, Pull requests. The bar is the system's own (`UITabBar`,
 * Material's navigation bar on Android), so iOS 26 draws it in Liquid Glass,
 * shrinks it on scroll and keeps its haptics. Each icon is the SF Symbol, or
 * the Material symbol, nearest the rail's glyph. On iOS the selected one is
 * tinted the brand blue; on Android the bar is quiet, icons only in ink and
 * grey on the screen's background (`TAB_BAR`), coloured whole because the
 * system's follows the phone's light or dark and Material's stock purple.
 * Five is as many as the bar holds before it folds the rest into More, which
 * is why Account is the avatar at the top of every tab and not a sixth.
 */
const SECTIONS = [
  {
    name: 'index',
    title: 'nav.sessions',
    sf: { default: 'apple.terminal', selected: 'apple.terminal.fill' },
    md: 'terminal',
  },
  {
    name: 'plan',
    title: 'nav.plan',
    sf: { default: 'square.3.layers.3d', selected: 'square.3.layers.3d' },
    md: 'layers',
  },
  {
    name: 'employees',
    title: 'nav.employees',
    sf: { default: 'person.2', selected: 'person.2.fill' },
    md: 'smart_toy',
  },
  {
    name: 'automations',
    title: 'nav.automations',
    sf: { default: 'bolt', selected: 'bolt.fill' },
    md: 'bolt',
  },
  {
    name: 'pull-requests',
    title: 'nav.pullRequestsShort',
    sf: { default: 'arrow.triangle.pull', selected: 'arrow.triangle.pull' },
    md: 'merge',
  },
] as const;

export default function TabsLayout() {
  const { t } = useTranslation();
  const scheme = useColorScheme().colorScheme === 'dark' ? 'dark' : 'light';
  const bar = TAB_BAR[scheme];

  return (
    <NativeTabs
      minimizeBehavior="onScrollDown"
      tintColor={THEME[scheme].primary}
      {...(Platform.OS === 'android' && {
        backgroundColor: bar.background,
        iconColor: { default: bar.icon, selected: bar.iconSelected },
        labelVisibilityMode: 'unlabeled' as const,
        indicatorColor: bar.indicator,
        rippleColor: bar.ripple,
      })}
    >
      {SECTIONS.map((section) => (
        <NativeTabs.Trigger key={section.name} name={section.name}>
          <NativeTabs.Trigger.Label>{t(section.title)}</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={section.sf} md={section.md} />
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  );
}
