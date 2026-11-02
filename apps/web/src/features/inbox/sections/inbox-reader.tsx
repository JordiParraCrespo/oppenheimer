import { cn } from '@oppenheimer/design-system-web';
import { QueryState } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { InboxPaneSkeleton } from '@/features/inbox/components/inbox-pane-skeleton';
import { InboxCurrent } from '@/features/inbox/sections/inbox-current';

/**
 * The Inbox's reading pane, read under Suspense: the item in hand under its
 * toolbar. On a phone it shows only once an item is opened (`reading`).
 */
export function InboxReader({ reading }: { reading: boolean }) {
  const { t } = useTranslation();

  return (
    <section
      aria-label={t('inbox.pane.label')}
      className={cn('flex min-h-0 min-w-0 flex-1 flex-col', !reading && 'max-md:hidden')}
    >
      <QueryState>
        <QueryState.Pending>
          <InboxPaneSkeleton />
        </QueryState.Pending>
        <QueryState.Error fallback={t('inbox.list.failed')} className="mx-8 mt-6" />
        <QueryState.Data>
          <InboxCurrent />
        </QueryState.Data>
      </QueryState>
    </section>
  );
}
