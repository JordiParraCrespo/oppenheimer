import { TokenMono, useNow, WeekdayStrip } from '@oppenheimer/design-system-web';
import { formatCountdown, useLocale } from '@oppenheimer/frontend-web';
import { nextScheduleOccurrence } from '@oppenheimer/shared/automations';
import { useTranslation } from 'react-i18next';
import type { ScheduleCard } from '../lib/automation-draft';
import { nextInstantText } from '../lib/automation-view';
import { localDate, viewerTimeZone } from '../lib/time';
import { weekdayName } from '../lib/trigger-text';

const DAY = 86_400_000;

/**
 * The line under a schedule card: the next seven days as a strip (the days it
 * fires filled, the next one ringed), then when it next runs and how long
 * until then, or that a once has already passed. Computed by the same
 * arithmetic the scheduler fires with, so the preview cannot disagree.
 */
export function SchedulePreview({ card }: { card: ScheduleCard }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const now = useNow(30_000);
  const zone = viewerTimeZone();

  const fires = new Set<string>();
  let cursor = new Date(now);
  for (let i = 0; i < 200; i += 1) {
    const at = nextScheduleOccurrence(card, cursor);
    if (!at || at.getTime() - now > 7 * DAY) break;
    fires.add(localDate(at.getTime(), zone));
    cursor = at;
  }
  const next = nextScheduleOccurrence(card, new Date(now));
  const nextDay = next ? localDate(next.getTime(), zone) : null;

  const days = Array.from({ length: 7 }, (_, offset) => {
    const at = now + offset * DAY;
    const key = localDate(at, zone);
    const weekday = new Date(`${key}T12:00:00Z`).getUTCDay();
    return {
      label: weekdayName(weekday, locale, 'narrow'),
      fires: fires.has(key),
      next: key === nextDay,
    };
  });

  return (
    <>
      <WeekdayStrip days={days} />
      {next ? (
        <>
          <span>{t('automations.editor.nextRun')}</span>
          <TokenMono>{nextInstantText(next, now, locale, t)}</TokenMono>
          <span>{t('automations.editor.inRel')}</span>
          <TokenMono>{formatCountdown(next.getTime() - now, locale)}</TokenMono>
        </>
      ) : (
        <span>{t('automations.editor.passed')}</span>
      )}
    </>
  );
}
