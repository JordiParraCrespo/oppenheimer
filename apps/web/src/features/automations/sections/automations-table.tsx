import { RoutineTable, RoutineTableEmpty } from '@oppenheimer/design-system-web';
import { Zap } from '@oppenheimer/design-system-web/icons';
import { useTranslation } from 'react-i18next';

/**
 * The overview's Automations view (`product/versions/mvp/13-automations.md`):
 * the table of the workspace's automations. The control plane has none to
 * list yet, so the table says what an automation is; the rows, the run
 * history over them and the templates arrive with the API.
 */
export function AutomationsTable() {
  const { t } = useTranslation();

  return (
    <RoutineTable>
      <RoutineTableEmpty>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-pill bg-hover-surface text-fg-muted [&_svg]:size-4">
          <Zap />
        </span>
        <span>{t('automations.page.empty')}</span>
      </RoutineTableEmpty>
    </RoutineTable>
  );
}
