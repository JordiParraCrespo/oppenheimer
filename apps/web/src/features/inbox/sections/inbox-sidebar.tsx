import { SidebarListHead, Skeleton } from '@oppenheimer/design-system-web';
import { QueryState } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { InboxFolders } from '@/features/inbox/sections/inbox-folders';

/**
 * The Inbox's sidebar, as a mail client's folders: every kind of item with
 * how many need you (Pull requests only while they are shown), then every
 * project that holds one, No project last. A folder is the list's Type or
 * Project facet, so a folder is a link and Back undoes it; the filter menu
 * keeps the rest. Counts are the facets' own: a kind's under the project
 * picked, a project's under the kind picked.
 */
export function InboxSidebar() {
  const { t } = useTranslation();

  return (
    <nav
      aria-label={t('inbox.folders.label')}
      className="no-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto pb-5"
    >
      <QueryState>
        <QueryState.Pending>
          <SidebarListHead label={t('inbox.folders.kinds')} />
          <div className="flex flex-col gap-2.5 px-5 pt-2.5" aria-hidden>
            {['w-24', 'w-20', 'w-16', 'w-20'].map((width, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: placeholder bars with nothing of their own.
              <Skeleton key={index} shape="sm" className={`h-3 ${width}`} />
            ))}
          </div>
        </QueryState.Pending>
        <QueryState.Error fallback={t('inbox.list.failed')} className="mx-3 mt-3" />
        <QueryState.Data>
          <InboxFolders />
        </QueryState.Data>
      </QueryState>
    </nav>
  );
}
