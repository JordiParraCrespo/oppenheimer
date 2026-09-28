import { Skeleton } from '@oppenheimer/design-system-web';

/** The pane's shape while the session is being read, at the size it will be. */
export function SessionSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col p-3.5">
      <Skeleton className="mx-auto min-h-0 w-full max-w-[1040px] flex-1 rounded-none" />
    </div>
  );
}
