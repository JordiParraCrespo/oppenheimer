import { BotList, Skeleton } from '@oppenheimer/design-system-web';
import { QueryState } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { BotsSidebarList } from './bots-sidebar-list';

/**
 * The console's sidebar body on its Employees list: the bots, read under
 * Suspense. New bot is the brand row's plus (`NewBotButton`), which needs no
 * read and stays in every state. The top inset is room for the search
 * field's focus ring, which the scrolling sidebar body would clip.
 */
export function BotsSidebar() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-0 flex-1 flex-col pt-1">
      <QueryState>
        <QueryState.Pending>
          <BotList className="mx-3 mt-1">
            <Skeleton shape="sm" className="h-13 w-full" />
            <Skeleton shape="sm" className="h-13 w-full" />
            <Skeleton shape="sm" className="h-13 w-full" />
          </BotList>
        </QueryState.Pending>
        <QueryState.Error fallback={t('bots.sidebar.loadFailed')} className="mx-3 mt-1" />
        <QueryState.Data>
          <BotsSidebarList />
        </QueryState.Data>
      </QueryState>
    </div>
  );
}
