import {
  RoutineTable,
  RoutineTableHead,
  RoutineTableRowSkeleton,
} from '@oppenheimer/design-system-web';
import { QueryState } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { BotRoutinesTable } from '../sections/bot-routines-table';
import { OverviewTop } from '../sections/overview-top';

/** The overview on its Bot routines tab: the tabs and every bot's routines. */
export function RoutinesOverviewScreen() {
  const { t } = useTranslation();
  return (
    <>
      <OverviewTop />
      <QueryState>
        <QueryState.Pending>
          <RoutineTable aria-busy>
            <RoutineTableHead
              aria-hidden
              columns={[
                t('automations.routines.routine'),
                t('automations.table.trigger'),
                t('automations.table.next'),
                t('automations.table.status'),
              ]}
            />
            <RoutineTableRowSkeleton index={0} />
            <RoutineTableRowSkeleton index={1} />
          </RoutineTable>
        </QueryState.Pending>
        <QueryState.Error fallback={t('automations.routines.loadFailed')} />
        <QueryState.Data>
          <BotRoutinesTable />
        </QueryState.Data>
      </QueryState>
    </>
  );
}
