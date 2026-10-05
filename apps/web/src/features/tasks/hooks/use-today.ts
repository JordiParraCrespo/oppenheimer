import { useNow } from '@oppenheimer/design-system-web';
import { todayIn } from '@oppenheimer/frontend-web';

/**
 * Today in the reader's timezone, as a calendar day. Due dates are wall-clock
 * days (`18-plan-product.md`, open question 1), so "overdue" turns at local
 * midnight; a minute's clock is close enough for that.
 */
export function useToday(): string {
  return todayIn(useNow(60_000));
}
