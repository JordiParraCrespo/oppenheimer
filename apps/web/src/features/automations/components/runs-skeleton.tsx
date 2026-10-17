import { RunsList, Skeleton } from '@oppenheimer/design-system-web';

/** The runs list's place while its first page has not answered. */
export function RunsSkeleton() {
  return (
    <RunsList>
      <div className="flex flex-col gap-1 p-1.5">
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
      </div>
    </RunsList>
  );
}
