import { BotList, Skeleton } from '@oppenheimer/design-system-web';
import { QueryState } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { BotsSidebarList } from './bots-sidebar-list';

/**
 * The console's sidebar body on its Employees list: the bots, read under
 * Suspense. New bot is the brand row's plus (`NewBotButton`), which needs no
 * read and stays in every state.
 */
export function BotsSidebar() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <QueryState>
        <QueryState.Pending>
          <BotList className="mx-3 mt-2">
            <Skeleton shape="sm" className="h-13 w-full" />
            <Skeleton shape="sm" className="h-13 w-full" />
            <Skeleton shape="sm" className="h-13 w-full" />
          </BotList>
        </QueryState.Pending>
        <QueryState.Error fallback={t('bots.sidebar.loadFailed')} className="mx-3 mt-2" />
        <QueryState.Data>
          <BotsSidebarList />
        </QueryState.Data>
      </QueryState>
    </div>
  );
}
