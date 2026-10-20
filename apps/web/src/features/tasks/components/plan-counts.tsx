import {
  PageHeaderMeta,
  PageHeaderSep,
  PageHeaderStat,
  Skeleton,
} from '@oppenheimer/design-system-web';
import { useTranslation } from 'react-i18next';
import type { boardCounts } from '../lib/board';

const PENDING = <Skeleton shape="sm" className="inline-block h-2.5 w-2 align-[-0.05em]" />;

/**
 * A Plan header's counts line: open, in progress, done, and overdue in red
 * when there is any. Before the tasks answer it keeps its place, a bar where
 * each figure goes, so the page under the header does not drop when they land;
 * a read that failed shows no line, not bars that never resolve.
 */
export function PlanCounts({
  counts,
  pending,
}: {
  counts: ReturnType<typeof boardCounts> | undefined;
  pending: boolean;
}) {
  const { t } = useTranslation();
  if (!counts && !pending) return null;
  return (
    <PageHeaderMeta indent={false}>
      <PageHeaderStat value={counts ? counts.open : PENDING}>
        {t('tasks.board.stats.open')}
      </PageHeaderStat>
      <PageHeaderSep />
      <PageHeaderStat value={counts ? counts.doing : PENDING}>
        {t('tasks.board.stats.doing')}
      </PageHeaderStat>
      <PageHeaderSep />
      <PageHeaderStat value={counts ? counts.done : PENDING}>
        {t('tasks.board.stats.done')}
      </PageHeaderStat>
      {counts?.overdue ? (
        <>
          <PageHeaderSep />
          <PageHeaderStat value={counts.overdue} tone="danger">
            {t('tasks.board.stats.overdue')}
          </PageHeaderStat>
        </>
      ) : null}
    </PageHeaderMeta>
  );
}
