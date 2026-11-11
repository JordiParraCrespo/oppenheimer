import { Button, EditorPageTop, PillTab, PillTabs } from '@oppenheimer/design-system-web';
import { Link, useRouterState } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useConsoleDialog } from '@/lib/console';
import { OVERVIEW_TABS, overviewTabOf } from '../lib/overview-tabs';

/**
 * The overview's first row: its three views as tabs, each the router's link,
 * so the address is what says which is open; and New automation on the
 * right, which asks the console for its editor dialog.
 */
export function OverviewTop() {
  const { t } = useTranslation();
  const tab = useRouterState({
    select: (state) => overviewTabOf(state.location.pathname) ?? 'automations',
  });
  const dialogs = useConsoleDialog();

  return (
    <EditorPageTop>
      <PillTabs value={tab} onValueChange={() => {}}>
        {OVERVIEW_TABS.map((item) => (
          <PillTab key={item.value} value={item.value} render={<Link to={item.to} />}>
            {t(`automations.page.tabs.${item.value}`)}
          </PillTab>
        ))}
      </PillTabs>
      <Button variant="secondary" size="sm" onClick={() => dialogs.open({ kind: 'automation' })}>
        {t('automations.page.new')}
      </Button>
    </EditorPageTop>
  );
}
