import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { ApiKeysSection } from '@/features/api-tokens/sections/api-keys';
import {
  SETTINGS_PANES,
  SettingsScreen,
  type SettingsSectionKey,
} from '@/features/hosts/screens/settings';
import { GeneralSettingsSection } from '@/features/organizations/sections/general-settings';
import { SecuritySection } from '@/features/profile/sections/security';

/**
 * The open pane lives in the URL rather than in component state: it costs
 * nothing and buys a settings link someone can send, and a back button that
 * steps between panes instead of leaving the screen.
 *
 * Everything else in the search string is carried through untouched. What
 * `validateSearch` returns *becomes* the search, so narrowing it to `section`
 * would delete a table's `tokens_page` on the next navigation. `section` is
 * still the only key this route reads or trusts.
 */
export const Route = createFileRoute('/_authenticated/settings/')({
  validateSearch: (
    search: Record<string, unknown>,
  ): Record<string, unknown> & { section?: SettingsSectionKey } => {
    const { section: requested, ...rest } = search;
    return SETTINGS_PANES.includes(requested as SettingsSectionKey)
      ? { ...rest, section: requested as SettingsSectionKey }
      : rest;
  },
  component: SettingsPage,
});

function SettingsPage() {
  const { section = 'general' } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  return (
    <SettingsScreen
      section={section}
      // Replaces the search rather than merging into it, so a table's own state
      // does not follow the reader into a pane that has no table.
      onSectionChange={(next) => navigate({ search: { section: next } })}
      panes={{
        general: (organization, loading) => (
          <GeneralSettingsSection organization={organization} loading={loading} />
        ),
        security: <SecuritySection />,
        api: <ApiKeysSection />,
      }}
    />
  );
}
