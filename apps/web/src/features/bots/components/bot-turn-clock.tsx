import { useNow } from '@oppenheimer/design-system-web';
import { CORE_CONFIG } from '@oppenheimer/frontend-core/config';
import { formatElapsed } from '@oppenheimer/frontend-web';

/** How long a running turn has run, as a clock that ticks: the one leaf the tick redraws. */
export function BotTurnClock({ since }: { since: Date }) {
  const now = useNow(CORE_CONFIG.clock.everySecondMs);
  return <>{formatElapsed(now - since.getTime())}</>;
}
