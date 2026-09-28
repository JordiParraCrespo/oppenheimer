import { PageHeaderSep, useNow } from '@oppenheimer/design-system-web';
import type { AutomationEntity } from '@oppenheimer/frontend-consumer';
import { useLocale } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { nextRunCountdown } from '../lib/automation-view';

/**
 * "· Next in 14h 56m 54s" in a page header's facts, ticking each second.
 * Its own leaf, so the tick redraws this line and not the header.
 */
export function NextRunCountdown({ automation }: { automation: AutomationEntity }) {
  const { t } = useTranslation();
  const now = useNow(1000);
  const locale = useLocale();
  const relative = nextRunCountdown(automation, now, locale);
  if (!relative) return null;
  return (
    <>
      <PageHeaderSep />
      <span>{t('automations.next.nextIn')}</span>
      <span className="figures text-fg">{relative}</span>
    </>
  );
}
