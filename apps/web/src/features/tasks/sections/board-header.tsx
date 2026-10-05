import {
  Button,
  PageHeader,
  PageHeaderMeta,
  PageHeaderRow,
  PageHeaderSep,
  PageHeaderStat,
} from '@oppenheimer/design-system-web';
import { Plus } from '@oppenheimer/design-system-web/icons';
import { useProjects, useTasks } from '@oppenheimer/frontend-consumer/react';
import { useTranslation } from 'react-i18next';
import { useBoardFilter } from '../hooks/use-board-filter';
import { useToday } from '../hooks/use-today';
import { boardCounts } from '../lib/board';

/**
 * The board's header (`18-plan-product.md` §2): the title ("Tasks", the
 * project, or Unassigned), the counts with overdue in red, and New task.
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
    <PageHeader>
      <PageHeaderRow
        size="display"
        title={title ?? t('tasks.board.title')}
        actions={
          <Button onClick={onNew}>
            <Plus />
            {t('tasks.board.newTask')}
          </Button>
        }
      />
      {counts ? (
        <PageHeaderMeta indent={false}>
          <PageHeaderStat value={counts.open}>{t('tasks.board.stats.open')}</PageHeaderStat>
          <PageHeaderSep />
          <PageHeaderStat value={counts.doing}>{t('tasks.board.stats.doing')}</PageHeaderStat>
          <PageHeaderSep />
          <PageHeaderStat value={counts.done}>{t('tasks.board.stats.done')}</PageHeaderStat>
          {counts.overdue ? (
            <>
              <PageHeaderSep />
              <PageHeaderStat value={counts.overdue} tone="danger">
                {t('tasks.board.stats.overdue')}
              </PageHeaderStat>
            </>
          ) : null}
        </PageHeaderMeta>
      ) : null}
    </PageHeader>
  );
}
