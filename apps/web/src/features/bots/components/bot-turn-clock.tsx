import { useNow } from '@oppenheimer/design-system-web';
import { CORE_CONFIG } from '@oppenheimer/frontend-core/config';
import { formatTimeAway, useLocale } from '@oppenheimer/frontend-web';

/** How long a running turn has run ("6s", "1m 5s"), ticking: the one leaf the tick redraws. */
export function BotTurnClock({ since }: { since: Date }) {
  const now = useNow(CORE_CONFIG.clock.everySecondMs);
  const locale = useLocale();
  return <>{formatTimeAway(now - since.getTime(), locale)}</>;
}
