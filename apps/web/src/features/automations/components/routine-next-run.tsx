import { useNow } from '@oppenheimer/design-system-web';
import type { BotRoutineEntity } from '@oppenheimer/frontend-consumer';
import { CORE_CONFIG } from '@oppenheimer/frontend-core/config';
import { useLocale } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { routineNextText } from '../lib/automation-view';

/**
 * A bot routine's next-run cell: the clock time as the automations' cell
 * says it, which turns over by the minute. Its own leaf, so a tick redraws one line.
 */
export function RoutineNextRun({ routine }: { routine: BotRoutineEntity }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const now = useNow(CORE_CONFIG.clock.everyMinuteMs);
  return <span>{routineNextText(routine, now, locale, t)}</span>;
}
