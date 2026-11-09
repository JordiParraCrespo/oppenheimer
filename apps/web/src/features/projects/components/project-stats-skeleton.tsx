import { Panel, Skeleton, StatCard } from '@oppenheimer/design-system-web';
import { LoadingStatus } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/** A rising and falling line's points, as heights: a shape, not data. */
const POINTS = [
  'h-[40%]',
  'h-[55%]',
  'h-[35%]',
  'h-[60%]',
  'h-[45%]',
  'h-[70%]',
  'h-[50%]',
  'h-[65%]',
];

const DELTA = (
  <span className="flex h-4.25 items-center">
    <Skeleton shape="sm" className="h-2.5 w-20" />
  </span>
);

/**
 * A project's Stats before the period answers: the two task cards with their
 * labels, a bar for each figure and its change, and the tasks panel with its
 * title and the chart's shape, so nothing above the fold moves when it lands.
 */
export function ProjectStatsSkeleton() {
  const { t } = useTranslation();
  return (
    <div aria-busy className="contents">
      <LoadingStatus />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-3">
        {[t('projects.stats.tasksCompleted'), t('projects.stats.tasksCreated')].map((label) => (
          <StatCard
            key={label}
            label={label}
            value={<Skeleton shape="sm" className="my-1 h-5 w-14" />}
            detail={DELTA}
          />
        ))}
      </div>
      <Panel title={t('projects.stats.tasksTitle')}>
        <div aria-hidden className="flex h-55 items-end gap-3 pl-10.5">
          {POINTS.map((height, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: a point's place is its identity.
            <Skeleton key={index} shape="sm" className={`min-w-0 flex-1 opacity-60 ${height}`} />
          ))}
        </div>
      </Panel>
    </div>
  );
}
