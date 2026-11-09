import {
  Button,
  DialogDescription,
  SearchableFacetMultiSelect,
  Skeleton,
} from '@oppenheimer/design-system-web';
import { ListChecks } from '@oppenheimer/design-system-web/icons';
import { LoadingStatus } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/**
 * Add undated tasks while the plan loads: the line and the buttons as they
 * will read (both know only the day; Cancel already works), and between
 * them the filter row and the search list's frame, its field and three rows
 * together, each a bar at a menu row's height. In the row, Project is a bar
 * (a narrowed page names its project there) and Status the facet itself,
 * unset as it always opens, with nothing to pick yet.
 */
export function UndatedPickerSkeleton({ date, onCancel }: { date: string; onCancel: () => void }) {
  const { t } = useTranslation();
  return (
    <div aria-busy className="flex flex-col gap-4">
      <LoadingStatus />
      <DialogDescription>{t('tasks.todo.schedule.for', { date })}</DialogDescription>
      <div className="flex items-center gap-2">
        <Skeleton shape="pill" className="h-7.5 w-24" />
        <SearchableFacetMultiSelect
          variant="pill"
          label={t('tasks.dialog.status')}
          icon={<ListChecks />}
          searchPlaceholder={t('tasks.todo.schedule.searchStatuses')}
          emptyText={(query) => t('common.search.noMatch', { query })}
          values={[]}
          onValuesChange={() => {}}
          options={[{ value: 'all', label: t('tasks.todo.schedule.allStatuses') }]}
        />
      </div>
      <div className="flex flex-col">
        <div className="px-1 pt-1">
          <Skeleton shape="sm" className="h-(--control-h-md) w-full" />
        </div>
        <div className="p-1">
          {['w-56', 'w-40', 'w-64'].map((width) => (
            <span key={width} className="flex h-7.5 items-center gap-2 px-2">
              <Skeleton shape="sm" className={`h-3 ${width} max-w-full`} />
            </span>
          ))}
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button type="button" disabled>
          {t('tasks.todo.schedule.submit', { date })}
        </Button>
      </div>
    </div>
  );
}
