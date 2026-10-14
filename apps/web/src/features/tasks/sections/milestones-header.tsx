import {
  Button,
  IconButton,
  PageHeader,
  PageHeaderMeta,
  PageHeaderRow,
  PageHeaderSep,
  PageHeaderStat,
} from '@oppenheimer/design-system-web';
import { ChevronLeft, ChevronRight, Plus } from '@oppenheimer/design-system-web/icons';
import { useTasks } from '@oppenheimer/frontend-consumer/react';
import { useTranslation } from 'react-i18next';
import { useScopeProject } from '../hooks/use-scope-project';
import { useToday } from '../hooks/use-today';
import { boardCounts } from '../lib/board';

/**
 * The Milestones view's header (the 2026-10-13 `Tasks` frame): Milestones, the
 * board's counts for the project shown, then Today and Earlier / Later to move
 * the timeline, and New milestone.
 */
export function MilestonesHeader({
  onToday,
  onEarlier,
  onLater,
  onNew,
}: {
  onToday: () => void;
  onEarlier: () => void;
  onLater: () => void;
  onNew: () => void;
}) {
  const { t } = useTranslation();
  const today = useToday();
  const { projectId } = useScopeProject();
  const { data: counts } = useTasks({ select: (rows) => boardCounts(rows, { projectId }, today) });

  return (
    <PageHeader>
      <PageHeaderRow
        size="display"
        meta={
          counts ? (
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
          ) : null
        }
        title={t('tasks.milestones.title')}
        actions={
          <div className="flex items-center gap-1.5">
            <Button variant="secondary" size="sm" onClick={onToday}>
              {t('tasks.milestones.today')}
            </Button>
            <IconButton size="sm" aria-label={t('tasks.milestones.earlier')} onClick={onEarlier}>
              <ChevronLeft />
            </IconButton>
            <IconButton size="sm" aria-label={t('tasks.milestones.later')} onClick={onLater}>
              <ChevronRight />
            </IconButton>
            <Button className="ml-3" onClick={onNew}>
              <Plus />
              {t('tasks.milestones.new')}
            </Button>
          </div>
        }
      />
    </PageHeader>
  );
}
