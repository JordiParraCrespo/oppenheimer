'use client';

import { botsKeys } from './bots.keys';
import { useConsumerApp } from './context';

/**
 * Each bot's latest line to the person (`notify`), for the Inbox's combined
 * read: the key and the fetch. `botNotice.changed` refetches it.
 */
export function useBotNoticesQuery() {
  const app = useConsumerApp();
  return {
    queryKey: botsKeys.workspaceNotices(),
    queryFn: () => app.bots.findWorkspaceNotices(),
  };
}
