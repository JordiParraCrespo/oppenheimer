import { Button, PageHeader, PageHeaderRow } from '@oppenheimer/design-system-web';
import { Plus } from '@oppenheimer/design-system-web/icons';
import { useTasks } from '@oppenheimer/frontend-consumer/react';
import { useTranslation } from 'react-i18next';
import { PlanCounts } from '../components/plan-counts';
import { useBoardFilter } from '../hooks/use-board-filter';
import { useToday } from '../hooks/use-today';
import { boardCounts } from '../lib/board';

/**
 * The board's header (the 2026-10-13 `Tasks` frame): Tasks, the counts of
 * what the filters show with overdue in red, and New task.
 */
export function BoardHeader({ onNew }: { onNew: () => void }) {
  const { t } = useTranslation();
  const filter = useBoardFilter();
  const today = useToday();
  const { data: counts } = useTasks({ select: (rows) => boardCounts(rows, filter, today) });

  return (
    <PageHeader>
      <PageHeaderRow
        size="display"
        meta={<PlanCounts counts={counts} />}
        title={t('tasks.board.title')}
        actions={
          <Button onClick={onNew}>
            <Plus />
            {t('tasks.board.newTask')}
          </Button>
        }
      />
    </PageHeader>
  );
}
