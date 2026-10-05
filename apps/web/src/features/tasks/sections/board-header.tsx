import { Button } from '@oppenheimer/design-system-web';
import { Plus } from '@oppenheimer/design-system-web/icons';
import { useProjects, useTasks } from '@oppenheimer/frontend-consumer/react';
import { useTranslation } from 'react-i18next';
import { useBoardFilter } from '../hooks/use-board-filter';
import { useToday } from '../hooks/use-today';
import { boardCounts } from '../lib/board';

/**
 * The board's header (`18-plan-product.md` §2): the title ("Tasks", the
 * project, or Unassigned), the counts line with overdue in red, and New task.
 */
export function BoardHeader({ onNew }: { onNew: () => void }) {
  const { t } = useTranslation();
  const filter = useBoardFilter();
  const today = useToday();
  const { data: title } = useProjects({
    select: (rows) => {
      const project = rows.find((row) => row.id === filter.projectId);
      if (!project) return undefined;
      return project.isUnassigned ? t('tasks.sidebar.unassigned') : project.name;
    },
  });
  const { data: counts } = useTasks({ select: (rows) => boardCounts(rows, filter, today) });

  return (
    <header className="flex items-end gap-4">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h1 className="truncate text-h2 font-semibold tracking-tight">
          {title ?? t('tasks.board.title')}
        </h1>
        {counts ? (
          <p className="figures text-sm text-fg-muted">
            {t('tasks.board.counts', counts)}
            {counts.overdue ? (
              <>
                <span className="text-fg-subtle"> · </span>
                <span className="text-danger">
                  {t('tasks.board.overdue', { count: counts.overdue })}
                </span>
              </>
            ) : null}
          </p>
        ) : null}
      </div>
      <Button onClick={onNew}>
        <Plus />
        {t('tasks.board.newTask')}
      </Button>
    </header>
  );
}
