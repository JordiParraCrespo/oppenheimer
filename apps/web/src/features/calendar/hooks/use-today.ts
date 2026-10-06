import { useNow } from '@oppenheimer/design-system-web';
import { todayIn } from '@oppenheimer/frontend-web';

/** Today in the reader's timezone, on a minute's clock: the grid's ring moves at midnight. */
export function useToday(): string {
  return todayIn(useNow(60_000));
}
