import { QueryState } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { InboxSidebarSkeleton } from '@/features/inbox/components/inbox-sidebar-skeleton';
import { InboxSidebarList } from '@/features/inbox/sections/inbox-sidebar-list';

/** The console's sidebar body on the Inbox: the list, read under Suspense. */
export function InboxSidebar() {
  const { t } = useTranslation();

  return (
    <QueryState>
      <QueryState.Pending>
        <InboxSidebarSkeleton />
      </QueryState.Pending>
      <QueryState.Error fallback={t('inbox.list.failed')} className="mx-3 mt-2" />
      <QueryState.Data>
        <InboxSidebarList />
      </QueryState.Data>
    </QueryState>
  );
}
