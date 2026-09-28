import { useNow } from '@oppenheimer/design-system-web';
import type { AutomationEntity } from '@oppenheimer/frontend-consumer';
import { useLocale } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { nextRunCountdown, nextRunText } from '../lib/automation-view';

/**
 * The table's next-run cell: the clock time, and under it a mono countdown
 * that ticks. Its own leaf so a second's tick redraws two lines, not the row.
 */
export function NextRun({ automation }: { automation: AutomationEntity }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const now = useNow(1000);
  const relative = nextRunCountdown(automation, now);
  return (
    <span className="flex flex-col gap-px">
      <span>{nextRunText(automation, now, locale, t)}</span>
      {relative ? (
        <span className="figures text-[11.5px] text-fg-subtle">
          {t('automations.next.in', { time: relative })}
        </span>
      ) : null}
    </span>
  );
}
