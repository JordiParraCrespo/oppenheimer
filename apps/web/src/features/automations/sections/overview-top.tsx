import { Button, EditorPageTop, PillTab, PillTabs } from '@oppenheimer/design-system-web';
import { Link, useMatchRoute } from '@tanstack/react-router';
import { lazy, Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';

/** The dialog loads when first opened. */
const AutomationEditorDialog = lazy(() =>
  import('../dialogs/automation-editor').then((module) => ({
    default: module.AutomationEditorDialog,
  })),
);

/**
 * The overview's first row: the two views as tabs, each the router's link,
 * so the address is what says which is open; and New automation on the
 * right, which opens the editor as a dialog over the console.
 */
export function OverviewTop() {
  const { t } = useTranslation();
  const matchRoute = useMatchRoute();
  const tab = matchRoute({ to: '/automations/runs' }) ? 'runs' : 'automations';
  // Whether New automation is up; this row is the lowest component that reads it.
  const [editing, setEditing] = useState(false);

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
      <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
        {t('automations.page.new')}
      </Button>
      <Suspense fallback={null}>
        {editing ? <AutomationEditorDialog onClose={() => setEditing(false)} /> : null}
      </Suspense>
    </EditorPageTop>
  );
}
