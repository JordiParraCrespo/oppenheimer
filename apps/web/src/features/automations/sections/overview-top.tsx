import { Button, EditorPageTop, PillTab, PillTabs } from '@oppenheimer/design-system-web';
import { Link, useMatchRoute } from '@tanstack/react-router';
import { lazy, Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';

/** The dialog loads when first opened. */
const NewAutomationDialog = lazy(() =>
  import('../dialogs/new-automation').then((module) => ({ default: module.NewAutomationDialog })),
);

/**
 * The overview's first row: the two views as tabs, each the router's link,
 * so the address is what says which is open; and New automation on the
 * right, which opens the New automation dialog over the console. Whether it
 * is open is this row's state: nothing else on the overview reads it.
 */
export function OverviewTop() {
  const { t } = useTranslation();
  const matchRoute = useMatchRoute();
  const tab = matchRoute({ to: '/automations/runs' }) ? 'runs' : 'automations';
  const [creating, setCreating] = useState(false);

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
      <Button variant="secondary" size="sm" onClick={() => setCreating(true)}>
        {t('automations.page.new')}
      </Button>
      <Suspense fallback={null}>
        {creating ? <NewAutomationDialog onClose={() => setCreating(false)} /> : null}
      </Suspense>
    </EditorPageTop>
  );
}
