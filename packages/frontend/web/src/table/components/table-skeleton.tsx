import { Skeleton } from '@oppenheimer/design-system-web';
import { useTranslation } from 'react-i18next';

/**
 * One skeleton per column, at the row height the real table settles into.
 *
 * `role="status"` and the visually-hidden label are not decoration: a skeleton
 * is a stack of empty `div`s, so without them a screen reader hears nothing at
 * all and the `0–0` pagination below reads as a finished, empty result. The
 * bare paragraph this replaced at least said "Loading".
 */
export function TableSkeleton({
  columns,
  rows = 5,
  selectable = true,
}: {
  columns: number;
  rows?: number;
  selectable?: boolean;
}) {
  const { t } = useTranslation();

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={t('common.loading')}
      className="flex flex-col gap-3.5 px-3 py-4"
    >
      {Array.from({ length: rows }, (_, row) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: placeholder rows have no identity
        <div key={row} className="flex items-center gap-4">
          {selectable && <Skeleton className="size-4 shrink-0 rounded" />}
          {Array.from({ length: columns }, (_, column) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: placeholder cells have no identity
            <Skeleton key={column} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}
