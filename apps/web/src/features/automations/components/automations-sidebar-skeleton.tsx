import {
  RoutineItem,
  SessionItemSkeleton,
  SessionList,
  SidebarListHead,
  SidebarProjectGroup,
  SidebarProjectHeader,
  SidebarSearch,
  Skeleton,
} from '@oppenheimer/design-system-web';
import { Zap } from '@oppenheimer/design-system-web/icons';
import { LoadingStatus } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/** Two groups as a workspace usually holds them: a busier project, then a quieter one. */
const GROUPS = [
  [0, 1, 2],
  [3, 4],
] as const;

/**
 * The automations sidebar below New automation while its read is pending,
 * on the loaded list's own parts: the Projects head with a bar where its
 * count goes, the search field with its placeholder, All (navigation, with
 * no count yet), then project groups, each a header with a name and a count
 * bar over row placeholders. The whole of it is inert until the data lands.
 */
export function AutomationsSidebarSkeleton() {
  const { t } = useTranslation();

  return (
    <div aria-busy inert className="flex min-h-0 flex-1 flex-col">
      <LoadingStatus />
      <SidebarListHead
        label={t('automations.sidebar.projects')}
        count={
          <span className="flex h-4 items-center">
            <Skeleton shape="sm" className="h-2.5 w-3" />
          </span>
        }
      />
      <SidebarSearch
        value=""
        onValueChange={() => {}}
        readOnly
        placeholder={t('automations.sidebar.search')}
        aria-label={t('automations.sidebar.search')}
      />
      <div className="min-h-0 flex-1 overflow-hidden pb-5">
        <div className="px-3 pt-2">
          <RoutineItem name={t('automations.sidebar.all')} icon={<Zap />} className="mb-1.5" />
        </div>
        {GROUPS.map((rows, group) => (
          <SidebarProjectGroup key={rows[0]}>
            <SidebarProjectHeader
              name={<Skeleton shape="sm" className={group === 0 ? 'h-2.5 w-24' : 'h-2.5 w-16'} />}
              count={<Skeleton shape="sm" className="ml-1 inline-block h-2.5 w-3" />}
            />
            <SessionList>
              {rows.map((row) => (
                <SessionItemSkeleton key={row} index={row} />
              ))}
            </SessionList>
          </SidebarProjectGroup>
        ))}
      </div>
    </div>
  );
}
