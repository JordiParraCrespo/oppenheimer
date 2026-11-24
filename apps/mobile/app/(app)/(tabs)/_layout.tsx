import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useTranslation } from 'react-i18next';

/**
 * The console rail's sections, in its order: Sessions, Plan, Employees,
 * Automations, Pull requests. The bar is the system's own (`UITabBar`,
 * Material's navigation bar on Android), so iOS 26 draws it in Liquid Glass,
 * shrinks it on scroll and keeps its haptics. Each icon is the SF Symbol, or
 * the Material symbol, nearest the rail's glyph. Five is as many as the bar
 * holds before it folds the rest into More, which is why Account is the
 * avatar at the top of every tab and not a sixth.
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

  return (
    <NativeTabs minimizeBehavior="onScrollDown">
      {SECTIONS.map((section) => (
        <NativeTabs.Trigger key={section.name} name={section.name}>
          <NativeTabs.Trigger.Label>{t(section.title)}</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={section.sf} md={section.md} />
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  );
}
