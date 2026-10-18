import { ChartHero, Panel, PanelGrid, Skeleton } from '@oppenheimer/design-system-web';
import { useTranslation } from 'react-i18next';
import { DELTA_PLACEHOLDER, StatCardSkeleton } from './stat-card-skeleton';

/** A per-day chart's bar heights: a shape, not data. */
const BARS = [
  'h-[32%]',
  'h-[38%]',
  'h-[30%]',
  'h-[35%]',
  'h-[30%]',
  'h-[40%]',
  'h-[34%]',
  'h-[36%]',
  'h-[30%]',
  'h-[42%]',
  'h-[50%]',
  'h-[46%]',
  'h-[52%]',
  'h-[50%]',
  'h-[56%]',
  'h-[54%]',
  'h-[60%]',
  'h-[52%]',
  'h-[57%]',
  'h-[50%]',
  'h-[56%]',
  'h-[62%]',
  'h-[55%]',
  'h-[60%]',
  'h-[68%]',
  'h-[80%]',
  'h-[74%]',
  'h-[90%]',
  'h-[70%]',
  'h-[62%]',
];

/**
 * Analytics before the period answers, under the header the screen draws for
 * real: every panel and card in its own frame at its height, its title and
 * labels written, a bar where each figure goes and the charts' shapes in
 * outline, so the numbers land in place and nothing below them moves.
 */
export function AnalyticsSkeleton({ rangeWord }: { rangeWord: string }) {
  const { t } = useTranslation();
  const vsPrevious = t('pullRequests.analytics.vsPrevious', { range: rangeWord });
  return (
    <div aria-busy className="contents">
      <span role="status" className="sr-only">
        {t('common.loading')}
      </span>
      <Panel>
        <div className="flex flex-wrap items-start gap-7">
          {(
            [
              ['chart-1', t('pullRequests.analytics.created')],
              ['chart-2', t('pullRequests.analytics.merged')],
            ] as const
          ).map(([tone, label]) => (
            <ChartHero
              key={tone}
              tone={tone}
              label={label}
              value={<Skeleton shape="sm" className="h-10 w-14" />}
              delta={DELTA_PLACEHOLDER}
            />
          ))}
          <span className="flex-1" />
          <Skeleton shape="pill" className="h-8 w-90" />
        </div>
        <div aria-hidden className="flex h-70.5 flex-col justify-end gap-3 pt-6">
          <div className="flex min-h-0 flex-1 items-end gap-1.5">
            {BARS.map((height, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: a bar's place is its identity.
              <Skeleton key={index} shape="sm" className={`min-w-0 flex-1 ${height}`} />
            ))}
          </div>
          <Skeleton shape="sm" className="h-2.5 w-full opacity-60" />
        </div>
        <div aria-hidden className="flex h-4 items-center gap-4">
          <Skeleton shape="sm" className="h-2.5 w-20" />
          <Skeleton shape="sm" className="h-2.5 w-20" />
        </div>
      </Panel>
      <div className="grid gap-3 md:grid-cols-3">
        <StatCardSkeleton label={t('pullRequests.analytics.reviewedByYou')} />
        <StatCardSkeleton label={t('pullRequests.analytics.waitForReview')} />
        <StatCardSkeleton label={t('pullRequests.analytics.timeToMerge')} />
      </div>
      <Panel title={t('pullRequests.analytics.waitTitle')} meta={vsPrevious}>
        <div className="grid gap-2 sm:grid-cols-2">
          <StatCardSkeleton label={t('pullRequests.analytics.agents')} />
          <StatCardSkeleton label={t('pullRequests.analytics.people')} />
        </div>
      </Panel>
      <PanelGrid>
        <Panel title={t('pullRequests.analytics.laneMix')} meta={vsPrevious}>
          <Skeleton aria-hidden shape="pill" className="size-37 self-center" />
          <div aria-hidden className="flex flex-col">
            {['w-16', 'w-20', 'w-14'].map((width) => (
              <div key={width} className="flex h-9.5 items-center gap-3">
                <Skeleton shape="sm" className={`h-2.5 ${width}`} />
                <span className="flex-1" />
                <Skeleton shape="sm" className="h-2.5 w-24" />
              </div>
            ))}
          </div>
        </Panel>
        <Panel
          title={t('pullRequests.analytics.waited')}
          meta={<Skeleton shape="sm" className="h-2.5 w-24" />}
        >
          <div aria-hidden className="flex flex-col gap-3">
            {['w-3/4', 'w-1/2', 'w-2/5', 'w-1/4'].map((width) => (
              <div key={width} className="flex h-13.5 flex-col justify-center gap-2">
                <div className="flex items-center justify-between">
                  <Skeleton shape="sm" className="h-2.5 w-32" />
                  <Skeleton shape="sm" className="h-2.5 w-10" />
                </div>
                <Skeleton shape="pill" className={`h-1.5 ${width}`} />
                <Skeleton shape="sm" className="h-2 w-24 opacity-60" />
              </div>
            ))}
          </div>
        </Panel>
      </PanelGrid>
    </div>
  );
}
