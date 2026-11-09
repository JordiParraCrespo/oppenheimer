import {
  IconButton,
  SessionItemSkeleton,
  SessionList,
  SidebarFoldLabel,
  SidebarListHead,
  SidebarProjectGroup,
  SidebarProjectHeader,
  SidebarSearch,
  Skeleton,
} from '@oppenheimer/design-system-web';
import { SlidersVertical } from '@oppenheimer/design-system-web/icons';
import { LoadingStatus } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/** Two groups as a workspace usually holds them: a busy project, then a quieter one. */
const GROUPS = [
  [0, 1, 2, 3, 4],
  [5, 6, 7],
] as const;

/**
 * The sessions sidebar while its read is pending, drawn on the loaded list's
 * own parts so nothing moves when it answers: the Sessions head with its
 * filter button and a bar where the count goes, the search field with its
 * placeholder, then project groups, each a header (a name and a count bar)
 * over `SessionItemSkeleton` rows. The whole of it is inert: the head and the
 * field are the real ones, and come alive with the data. A list the reader
 * folded away (`open` false) is the head alone, as it will be.
 */
export function SessionsSidebarSkeleton({ open }: { open: boolean }) {
  const { t } = useTranslation();

  return (
    <div aria-busy inert className="flex min-h-0 flex-1 flex-col">
      <LoadingStatus />
      <SidebarListHead
        label={
          <SidebarFoldLabel open={open} onOpenChange={() => {}}>
            {t('sessions.sidebar.sessions')}
          </SidebarFoldLabel>
        }
        count={
          <span className="flex h-4 items-center">
            <Skeleton shape="sm" className="h-2.5 w-4" />
          </span>
        }
      >
        <IconButton size="xs" variant="quiet" aria-label={t('sessions.filters.label')}>
          <SlidersVertical />
        </IconButton>
      </SidebarListHead>
      {open ? (
        <>
          <SidebarSearch
            value=""
            onValueChange={() => {}}
            readOnly
            placeholder={t('sessions.sidebar.search')}
            aria-label={t('sessions.sidebar.search')}
          />
          <div className="min-h-0 flex-1 overflow-hidden pb-5">
            {GROUPS.map((rows, group) => (
              <SidebarProjectGroup key={rows[0]}>
                <SidebarProjectHeader
                  name={
                    <Skeleton shape="sm" className={group === 0 ? 'h-2.5 w-24' : 'h-2.5 w-16'} />
                  }
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
        </>
      ) : null}
    </div>
  );
}
