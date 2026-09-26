import { Button, OverviewPageTop, PillTab, PillTabs } from '@oppenheimer/design-system-web';
import { Link, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

/**
 * The overview's first row: the two views as tabs — routes, so a tab is a
 * navigation and the address says which is open — and New automation on the
 * right.
 */
export function OverviewTop({ tab }: { tab: 'automations' | 'runs' }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <OverviewPageTop>
      <PillTabs
        value={tab}
        onValueChange={(next) =>
          navigate({ to: next === 'runs' ? '/automations/runs' : '/automations' })
        }
      >
        <PillTab value="automations">{t('automations.page.tabs.automations')}</PillTab>
        <PillTab value="runs">{t('automations.page.tabs.runs')}</PillTab>
      </PillTabs>
      <Button variant="secondary" size="sm" render={<Link to="/automations/new" />}>
        {t('automations.page.new')}
      </Button>
    </OverviewPageTop>
  );
}
