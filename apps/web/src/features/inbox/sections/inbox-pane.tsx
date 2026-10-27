import { QueryState } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { InboxPaneSkeleton } from '@/features/inbox/components/inbox-pane-skeleton';
import { InboxCurrent } from '@/features/inbox/sections/inbox-current';

/** The Inbox's pane, read under Suspense: the item in hand and the log above it. */
export function InboxPane() {
  const { t } = useTranslation();

  return (
    <QueryState>
      <QueryState.Pending>
        <InboxPaneSkeleton />
      </QueryState.Pending>
      <QueryState.Error fallback={t('inbox.list.failed')} className="mt-6" />
      <QueryState.Data>
        <InboxCurrent />
      </QueryState.Data>
    </QueryState>
  );
}
