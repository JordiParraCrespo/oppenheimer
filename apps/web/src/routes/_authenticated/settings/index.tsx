import { cn } from '@oppenheimer/design-system-web';
import { Cpu, Settings, ShieldCheck } from '@oppenheimer/design-system-web/icons';
import { useOrganizations } from '@oppenheimer/frontend/react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { PageHead } from '@/components/page-head';
import { ApiSection } from '@/components/settings/api-section';
import { GeneralSection } from '@/components/settings/general-section';
import { SecuritySection } from '@/components/settings/security-section';

/** The sub-nav's sections, in the design's order. */
const SECTIONS = [
  { key: 'general', icon: Settings },
  { key: 'security', icon: ShieldCheck },
  { key: 'api', icon: Cpu },
] as const;

type SectionKey = (typeof SECTIONS)[number]['key'];

const PANES: readonly SectionKey[] = SECTIONS.map((section) => section.key);

/**
 * The section lives in the URL rather than in component state.
 *
 * It costs nothing and buys a settings link someone can send to a colleague —
 * and a back button that steps between panes instead of leaving the screen.
 *
 * Everything else in the search string is carried through untouched. What
 * `validateSearch` returns *becomes* the search, so narrowing it to `section`
 * would delete a table's `tokens_page` on the next navigation — the table
 * would write it and the router would take it away. `section` is still the
 * only key this route reads or trusts.
 */
export const Route = createFileRoute('/_authenticated/settings/')({
  validateSearch: (
    search: Record<string, unknown>,
  ): Record<string, unknown> & { section?: SectionKey } => {
    const { section: requested, ...rest } = search;
    return PANES.includes(requested as SectionKey)
      ? { ...rest, section: requested as SectionKey }
      : rest;
  },
  component: SettingsPage,
});

function SettingsPage() {
  const { t } = useTranslation();
  const { section = 'general' } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const organizations = useOrganizations();
  const organization = organizations.data?.[0];

  // Replaces the search rather than merging into it, so a table's own state
  // does not follow the reader into a pane that has no table.
  const go = (next: SectionKey) => navigate({ search: { section: next } });

  return (
    <>
      <PageHead
        title={t('settings.title')}
        // The organization's name is only known once the list resolves, and a
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
          {SECTIONS.map(({ key, icon: Icon }) => {
            const active = section === key;

            return (
              <button
                key={key}
                type="button"
                onClick={() => go(key)}
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
          {section === 'general' && (
            <GeneralSection organization={organization} loading={organizations.isLoading} />
          )}
          {section === 'security' && <SecuritySection />}
          {section === 'api' && <ApiSection />}
        </div>
      </div>
    </>
  );
}
