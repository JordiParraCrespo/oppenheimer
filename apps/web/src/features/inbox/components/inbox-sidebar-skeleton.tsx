import { InboxItemSkeleton, InboxList, SidebarListHead } from '@oppenheimer/design-system-web';
import { LoadingStatus } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/** The list while the Inbox loads: its head written, a row's shape per item it usually holds, no count. */
export function InboxSidebarSkeleton() {
  const { t } = useTranslation();

  return (
    <div aria-busy className="flex min-h-0 flex-1 flex-col pb-5">
      <LoadingStatus />
      <SidebarListHead label={t('inbox.list.head')} />
      <InboxList className="px-2">
        <InboxItemSkeleton />
        <InboxItemSkeleton />
        <InboxItemSkeleton />
        <InboxItemSkeleton />
      </InboxList>
    </div>
  );
}
