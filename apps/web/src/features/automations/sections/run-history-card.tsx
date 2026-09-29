import { RunHistory, Skeleton } from '@oppenheimer/design-system-web';
import { useRunHistory } from '@oppenheimer/frontend-consumer/react';
import { useLocale } from '@oppenheimer/frontend-web';
import { RUN_HISTORY_DAYS } from '@oppenheimer/shared/automations';
import { useTranslation } from 'react-i18next';
import { monthDay, viewerTimeZone } from '../lib/time';

/** A `YYYY-MM-DD` local day as the axis prints it ("Sep 28"). */
function dayLabel(date: string | undefined, locale: string): string {
  if (!date) return '';
  const [year, month, day] = date.split('-').map(Number);
  return monthDay(new Date(Date.UTC(year, month - 1, day, 12)), locale, 'UTC');
}

/**
 * Run history: the last thirty local days as one bar each, the viewer's days
 * because the zone travels with the request. The overview's Automations tab
 * shows a "65 runs ›" link to the Runs tab where the Runs tab and an
 * automation's page show the legend. It is always drawn, a new workspace's
 * thirty empty days included, so the page keeps its shape from the first
 * visit; a card-sized placeholder holds the place while it loads.
 */
export function RunHistoryCard({
  automationId,
  onOpenRuns,
}: {
  automationId?: string;
  /** Present: the header links to the runs instead of printing the legend. */
  onOpenRuns?: () => void;
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { data } = useRunHistory({
    automationId,
    days: RUN_HISTORY_DAYS,
    timezone: viewerTimeZone(),
  });
  if (!data) return <Skeleton shape="lg" className="h-47.5 w-full" />;

  return (
    <RunHistory
      title={t('automations.history.title')}
      range={t('automations.history.range')}
      succeededLabel={t('automations.history.succeeded')}
      failedLabel={t('automations.history.failed')}
      days={data.days.map((day) => ({ date: day.date, ok: day.succeeded, failed: day.failed }))}
      link={
        onOpenRuns
          ? { label: t('automations.history.runs', { count: data.total }), onClick: onOpenRuns }
          : undefined
      }
      axis={[dayLabel(data.days[0]?.date, locale), dayLabel(data.days.at(-1)?.date, locale)]}
    />
  );
}
