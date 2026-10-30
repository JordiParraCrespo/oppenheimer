import {
  InboxItemSkeleton,
  InboxList,
  InboxListHead,
  Skeleton,
} from '@oppenheimer/design-system-web';
import { LoadingStatus, SidebarToggle } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/**
 * The list column while the Inbox loads: its head written with no count, the
 * search box's frame, and a mail row's shape per item it usually holds.
 */
export function InboxListSkeleton() {
  const { t } = useTranslation();

  return (
    <div aria-busy className="flex min-h-0 flex-1 flex-col">
      <LoadingStatus />
      <InboxListHead leading={<SidebarToggle />} title={t('inbox.title')} />
      <div aria-hidden className="shrink-0 border-b border-border-subtle px-3 pt-2.5 pb-2.5">
        <Skeleton className="h-7.5 w-full" />
      </div>
      <InboxList>
        <InboxItemSkeleton />
        <InboxItemSkeleton />
        <InboxItemSkeleton />
        <InboxItemSkeleton />
      </InboxList>
    </div>
  );
}
