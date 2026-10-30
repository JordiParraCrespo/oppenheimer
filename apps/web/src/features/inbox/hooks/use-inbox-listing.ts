import type { InboxItem } from '@oppenheimer/frontend-consumer';
import { useSuspenseInbox } from '@oppenheimer/frontend-consumer/react';
import { useTranslation } from 'react-i18next';
import { inboxCopy, matchesQuery } from '../lib/inbox-copy';
import { currentItem } from '../lib/inbox-current';
import { listedItems } from '../lib/inbox-filter';
import { useInboxSearch } from './use-inbox-search';
import { useInboxVisit } from './use-inbox-visit';

/**
 * What the list column draws and the reading pane takes its item from, in
 * one place so the two never disagree: the Inbox, its search, the open and
 * done items under the filter and the words, and the item the address names
 * (else the first).
 */
export function useInboxListing(now: number) {
  const { t } = useTranslation();
  // A refetch that fails is not drawn here: both callers draw `inbox.error` beside the data.
  const inbox = useSuspenseInbox(now);
  const visit = useInboxVisit();
  const search = useInboxSearch();

  const found = (item: InboxItem) => matchesQuery(inboxCopy(item, t), search.query);
  const { open, done } = listedItems(inbox, visit, search.filter, search.showDone, found);
  const current = currentItem(open, search.item, { answered: inbox.answered, done: visit.done });
  return { inbox, search, open, done, current };
}
