import { useNow } from '@oppenheimer/design-system-web';
import { CORE_CONFIG } from '@oppenheimer/frontend-core/config';
import { compactAge } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/**
 * How long ago a host last answered. It owns its own clock so the row around
 * it, and the list around that, never re-render for it; `now` is passed in
 * rather than read, so the age moves with the clock.
 */
export function LastSeen({ since }: { since: Date | null }) {
  const { t } = useTranslation();
  const now = useNow(CORE_CONFIG.clock.everyMinuteMs);
  const age = since ? compactAge(since, now) : null;
  if (!since) return null;

  return (
    <span className="figures text-fg-muted">
      {age ? t(`common.relative.${age.unit}`, { count: age.count }) : t('common.relative.now')}
    </span>
  );
}
