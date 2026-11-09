import {
  IconButton,
  InboxItemSkeleton,
  InboxList,
  InboxListHead,
} from '@oppenheimer/design-system-web';
import { SlidersVertical } from '@oppenheimer/design-system-web/icons';
import { LoadingStatus, SidebarSearchField, SidebarToggle } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/**
 * The list column while the Inbox loads: its head written with no count and
 * the filter button there, disabled; the real search field, inert, in the
 * band it sits in; and a mail row's shape per item it usually holds.
 */
export function InboxListSkeleton() {
  const { t } = useTranslation();

  return (
    <div aria-busy className="flex min-h-0 flex-1 flex-col">
      <LoadingStatus />
      <InboxListHead leading={<SidebarToggle />} title={t('inbox.title')}>
        <IconButton size="xs" variant="quiet" aria-label={t('inbox.filter.label')} disabled>
          <SlidersVertical />
        </IconButton>
      </InboxListHead>
      <div inert className="shrink-0 border-b border-border-subtle pt-2.5 pb-0.5">
        <SidebarSearchField
          value=""
          onChange={() => {}}
          label={t('inbox.list.search')}
          clearLabel={t('inbox.list.clearSearch')}
        />
      </div>
      <InboxList>
        {[0, 1, 2, 3].map((index) => (
          <InboxItemSkeleton key={index} index={index} />
        ))}
      </InboxList>
    </div>
  );
}
