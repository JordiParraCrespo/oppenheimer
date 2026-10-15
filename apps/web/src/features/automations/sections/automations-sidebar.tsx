import { Button, RoutineItem, Skeleton } from '@oppenheimer/design-system-web';
import { Zap } from '@oppenheimer/design-system-web/icons';
import { QueryState } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { useConsoleDialog } from '@/lib/console';
import { AutomationsSidebarList } from './automations-sidebar-list';

/**
 * The console's sidebar body on its automations list
 * (`product/versions/mvp/13-automations.md`): New automation, which needs no
 * read and stays in every state, and the list under it, read under Suspense.
 */
export function AutomationsSidebar() {
  const { t } = useTranslation();
  const dialogs = useConsoleDialog();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-3 pb-2.5">
        <Button size="sm" block onClick={() => dialogs.open({ kind: 'automation' })}>
          {t('automations.sidebar.new')}
        </Button>
      </div>
      <QueryState>
        <QueryState.Pending>
          <div className="flex flex-col gap-2 px-3 pt-2">
            <RoutineItem name={t('automations.sidebar.all')} icon={<Zap />} />
            <Skeleton className="h-7.5 w-full" />
            <Skeleton className="h-7.5 w-full" />
          </div>
        </QueryState.Pending>
        <QueryState.Error fallback={t('automations.sidebar.loadFailed')} className="mx-3 mt-2" />
        <QueryState.Data>
          <AutomationsSidebarList />
        </QueryState.Data>
      </QueryState>
    </div>
  );
}
