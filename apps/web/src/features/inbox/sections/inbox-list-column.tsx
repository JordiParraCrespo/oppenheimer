import { Button, cn, InboxListHead } from '@oppenheimer/design-system-web';
import { ErrorAlert, QueryState, SidebarToggle } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { InboxListSkeleton } from '@/features/inbox/components/inbox-list-skeleton';
import { InboxList } from '@/features/inbox/sections/inbox-list';

/**
 * The Inbox's list column, beside the reading pane: the list read under
 * Suspense, its head with the sidebar toggle in every state. On a phone it
 * takes the width, and gives way to the reading pane once an item is opened
 * (`reading`).
 */
export function InboxListColumn({ reading }: { reading: boolean }) {
  const { t } = useTranslation();

  return (
    <aside
      aria-label={t('inbox.title')}
      className={cn(
        'flex min-h-0 w-full shrink-0 flex-col border-border-subtle md:w-90 md:border-r',
        reading && 'max-md:hidden',
      )}
    >
      <QueryState>
        <QueryState.Pending>
          <InboxListSkeleton />
        </QueryState.Pending>
        <QueryState.Error>
          {(error, retry) => (
            <>
              <InboxListHead leading={<SidebarToggle />} title={t('inbox.title')} />
              <ErrorAlert
                error={error}
                fallback={t('inbox.list.failed')}
                className="mx-3 mt-3"
                action={
                  <Button variant="ghost" size="sm" onClick={retry}>
                    {t('common.retry')}
                  </Button>
                }
              />
            </>
          )}
        </QueryState.Error>
        <QueryState.Data>
          <InboxList />
        </QueryState.Data>
      </QueryState>
    </aside>
  );
}
