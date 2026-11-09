import { TodoRowSkeleton } from '@oppenheimer/design-system-web';
import { LoadingStatus } from '@oppenheimer/frontend-web';

/** The day's list while it loads: three rows on the rows' own frame. */
export function TodoListSkeleton() {
  return (
    <div aria-busy className="flex flex-col gap-2">
      <LoadingStatus />
      <TodoRowSkeleton />
      <TodoRowSkeleton />
      <TodoRowSkeleton />
    </div>
  );
}
