import { Button, EditorPageTop, PillTab, PillTabs } from '@oppenheimer/design-system-web';
import { Link, useMatchRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useConsoleDialog } from '@/lib/console';

/**
 * The overview's first row: the two views as tabs, each the router's link,
 * so the address is what says which is open; and New automation on the
 * right, which asks the console for its editor dialog.
 */
export function OverviewTop() {
  const { t } = useTranslation();
  const matchRoute = useMatchRoute();
  const tab = matchRoute({ to: '/automations/runs' }) ? 'runs' : 'automations';
  const dialogs = useConsoleDialog();

  return (
    <EditorPageTop>
      <PillTabs value={tab} onValueChange={() => {}}>
        <PillTab value="automations" render={<Link to="/automations" />}>
          {t('automations.page.tabs.automations')}
        </PillTab>
        <PillTab value="runs" render={<Link to="/automations/runs" />}>
          {t('automations.page.tabs.runs')}
        </PillTab>
      </PillTabs>
      <Button variant="secondary" size="sm" onClick={() => dialogs.open({ kind: 'automation' })}>
        {t('automations.page.new')}
      </Button>
    </EditorPageTop>
  );
}
