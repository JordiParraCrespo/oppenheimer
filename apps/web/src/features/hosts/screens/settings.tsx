import { cn } from '@oppenheimer/design-system-web';
import { Cpu, Server, Settings, ShieldCheck } from '@oppenheimer/design-system-web/icons';
import type { OrganizationEntity } from '@oppenheimer/frontend-consumer';
import { useOrganizations } from '@oppenheimer/frontend-consumer/react';
import { PageHead } from '@oppenheimer/frontend-web';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { HostsSection } from '@/features/hosts/sections/hosts';

/** The sub-nav's sections, in the design's order: hosts is the product's pane. */
export const SETTINGS_SECTIONS = [
  { key: 'general', icon: Settings },
  { key: 'hosts', icon: Server },
  { key: 'security', icon: ShieldCheck },
  { key: 'api', icon: Cpu },
] as const;

export type SettingsSectionKey = (typeof SETTINGS_SECTIONS)[number]['key'];

export const SETTINGS_PANES: readonly SettingsSectionKey[] = SETTINGS_SECTIONS.map(
  (section) => section.key,
);

interface SettingsScreenProps {
  /** The open pane, from the route's search. */
  section: SettingsSectionKey;
  onSectionChange: (next: SettingsSectionKey) => void;
  /**
   * The account panes, rendered by the features that own them. A feature never
   * imports another, so the route composes them and this screen only places
   * them: hosts is the one pane this feature renders itself.
   */
  panes: {
    general: (organization: OrganizationEntity | undefined, loading: boolean) => ReactNode;
    security: ReactNode;
    api: ReactNode;
  };
}

/**
 * Settings: hosts first (the machines that run sessions), then the account
 * chrome the console keeps — the workspace's name, the session list, API
 * tokens. The open pane lives in the URL so a link to `?section=hosts` can be
 * sent to a colleague and the back button steps between panes.
 */
export function SettingsScreen({ section, onSectionChange, panes }: SettingsScreenProps) {
  const { t } = useTranslation();
  const organizations = useOrganizations();
  const organization = organizations.data?.[0];

  return (
    <>
      <PageHead
        title={t('settings.title')}
        // The workspace's name is only known once the list resolves, and a
        // reader gets a heading either way — naming the workspace is not worth
        // a dangling "for ." while the lookup is in flight.
        sub={
          organization
            ? t('settings.subtitle', { organization: organization.name })
            : t('settings.subtitleFallback')
        }
      />

      <div className="grid items-start gap-[22px] min-[940px]:grid-cols-[216px_1fr] min-[940px]:gap-9">
        <nav aria-label={t('settings.nav.label')} className="sticky top-0 flex flex-col gap-0.5">
          {SETTINGS_SECTIONS.map(({ key, icon: Icon }) => {
            const active = section === key;

            return (
              <button
                key={key}
                type="button"
                onClick={() => onSectionChange(key)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex w-full cursor-pointer items-center gap-2.5 rounded-md border-none px-[11px] py-[9px] text-left font-sans text-base transition-colors',
                  active
                    ? 'bg-surface-sunken font-medium text-ink-900'
                    : 'bg-transparent text-ink-600 hover:bg-surface-hover hover:text-ink-900',
                )}
              >
                <Icon className={cn('size-[15px]', active ? 'text-ink-900' : 'text-ink-400')} />
                {t(`settings.nav.${key}`)}
              </button>
            );
          })}
        </nav>

        <div className="min-w-0">
          {section === 'general' && panes.general(organization, organizations.isLoading)}
          {section === 'hosts' && <HostsSection />}
          {section === 'security' && panes.security}
          {section === 'api' && panes.api}
        </div>
      </div>
    </>
  );
}
