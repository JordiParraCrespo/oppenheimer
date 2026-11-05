import { Skeleton } from '@oppenheimer/design-system-web';
import { TASK_STATUSES } from '@oppenheimer/shared/schemas/task';

/** The four columns before the board's first answer. */
export function BoardSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {TASK_STATUSES.map((column) => (
        <div key={column} className="flex flex-col gap-2.5">
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-35 w-full" />
        </div>
      ))}
    </div>
  );
}
