import { useNow } from '@oppenheimer/design-system-web';
import { useInboxCount } from '@oppenheimer/frontend-consumer/react';

/**
 * The Inbox's count on its rail item: how many things need you, nothing
 * until every read has answered. Loaded apart from the rail, so the Inbox's
 * composition is not on the console's first load (`pnpm check:bundle`).
 */
export function InboxRailCount() {
  const now = useNow(60_000);
  return useInboxCount(now) ?? null;
}
