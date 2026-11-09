import {
  BotItemSkeleton,
  BotList,
  Button,
  SidebarProjectGroup,
  SidebarProjectHeader,
  SidebarSearch,
  Skeleton,
} from '@oppenheimer/design-system-web';
import { Plus } from '@oppenheimer/design-system-web/icons';
import { LoadingStatus } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

const ROWS = [0, 1, 2, 3] as const;

/**
 * The Employees sidebar while its bots load, on the loaded list's own parts:
 * the search field with its placeholder, one group under an eyebrow header
 * (a name and a count bar) over `BotItemSkeleton` rows, then New group, which
 * needs no data. Inert until the list answers.
 */
export function BotsSidebarSkeleton() {
  const { t } = useTranslation();

  return (
    <div aria-busy inert className="flex min-h-0 flex-1 flex-col">
      <LoadingStatus />
      <SidebarSearch
        value=""
        onValueChange={() => {}}
        readOnly
        placeholder={t('bots.sidebar.search')}
        aria-label={t('bots.sidebar.search')}
      />
      <div className="min-h-0 flex-1 overflow-hidden pb-5">
        <SidebarProjectGroup>
          <SidebarProjectHeader
            tone="eyebrow"
            name={<Skeleton shape="sm" className="h-2.5 w-20" />}
            count={<Skeleton shape="sm" className="ml-1 inline-block h-2.5 w-3" />}
          />
          <BotList>
            {ROWS.map((row) => (
              <BotItemSkeleton key={row} index={row} />
            ))}
          </BotList>
        </SidebarProjectGroup>
        <div className="mt-2.5 flex flex-col px-3">
          <div>
            <Button variant="ghost" size="sm">
              <Plus />
              {t('bots.sidebar.newGroup')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
