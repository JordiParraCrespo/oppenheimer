import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useTranslation } from 'react-i18next';
import { WorkspaceGate } from '../../features/organizations/sections/workspace-gate';

/**
 * The export's sections, in the order its tab bar draws them. The bar is the
 * system's own (`UITabBar`, Material's navigation bar on Android), so iOS 26
 * draws it in Liquid Glass, shrinks it on scroll and keeps its haptics; each
 * icon is an SF Symbol there and a Material symbol on Android. `label` is the
 * short name under the icon when the title is too long for it.
 */
const SECTIONS = [
  {
    name: 'index',
    title: 'nav.sessions',
    sf: { default: 'terminal', selected: 'terminal.fill' },
    md: 'terminal',
  },
  {
    name: 'employees',
    title: 'nav.employees',
    sf: { default: 'person.2', selected: 'person.2.fill' },
    md: 'smart_toy',
  },
  {
    name: 'pull-requests',
    title: 'nav.pullRequestsShort',
    sf: { default: 'arrow.triangle.pull', selected: 'arrow.triangle.pull' },
    md: 'merge',
  },
  {
    name: 'automations',
    title: 'nav.automations',
    sf: { default: 'bolt', selected: 'bolt.fill' },
    md: 'bolt',
  },
  {
    name: 'account',
    title: 'nav.account',
    sf: { default: 'person.crop.circle', selected: 'person.crop.circle.fill' },
    md: 'account_circle',
  },
] as const;

/** The signed-in app: five sections behind the platform's tab bar. */
export default function AppLayout() {
  const { t } = useTranslation();

  return (
    <WorkspaceGate>
      <NativeTabs minimizeBehavior="onScrollDown">
        {SECTIONS.map((section) => (
          <NativeTabs.Trigger key={section.name} name={section.name}>
            <NativeTabs.Trigger.Label>{t(section.title)}</NativeTabs.Trigger.Label>
            <NativeTabs.Trigger.Icon sf={section.sf} md={section.md} />
          </NativeTabs.Trigger>
        ))}
      </NativeTabs>
    </WorkspaceGate>
  );
}
