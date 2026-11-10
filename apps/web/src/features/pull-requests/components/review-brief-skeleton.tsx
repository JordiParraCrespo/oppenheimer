import { Skeleton } from '@oppenheimer/design-system-web';

/** A brief being written: its sentence at the headline's height, then three points. */
export function ReviewBriefSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-hidden>
      <div className="flex flex-col gap-2.5">
        <Skeleton shape="sm" className="h-4 w-11/12" />
        <Skeleton shape="sm" className="h-4 w-3/5" />
      </div>
      <div className="flex flex-col gap-3 pl-5">
        <Skeleton shape="sm" className="h-2.5 w-4/5" />
        <Skeleton shape="sm" className="h-2.5 w-2/3" />
        <Skeleton shape="sm" className="h-2.5 w-3/4" />
      </div>
    </div>
  );
}
