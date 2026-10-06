import { useNow } from '@oppenheimer/design-system-web';
import { CORE_CONFIG } from '@oppenheimer/frontend-core/config';
import { formatAge } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/** "2m", "3h", "now": a session's age on a minute clock of its own, so the row around it never re-renders. */
export function SessionAge({ date }: { date: Date }) {
  const { t } = useTranslation();
  const now = useNow(CORE_CONFIG.clock.everyMinuteMs);
  return formatAge(date, now, t);
}
