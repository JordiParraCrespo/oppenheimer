import { CalendarAccountList, Skeleton } from '@oppenheimer/design-system-web';
import { LoadingStatus } from '@oppenheimer/frontend-web';

/**
 * The Google accounts before they answer: the account list with one row as
 * `CalendarAccountRow` draws it (the mark, the address over its status, the
 * ×) and the add row at its 40px, so the sidebar does not move when the
 * accounts land.
 */
export function GoogleAccountsSkeleton() {
  return (
    <CalendarAccountList aria-busy>
      <LoadingStatus />
      <div aria-hidden className="flex items-start gap-2.5 py-2.5 pr-2 pl-3">
        <Skeleton shape="pill" className="mt-0.75 size-[13px] shrink-0" />
        <span className="flex min-w-0 flex-1 flex-col gap-0.75">
          <span className="flex h-5 items-center">
            <Skeleton shape="sm" className="h-3 w-36" />
          </span>
          <span className="flex h-4 items-center">
            <Skeleton shape="sm" className="h-2.5 w-24" />
          </span>
        </span>
        <span className="flex size-6 shrink-0 items-center justify-center">
          <Skeleton shape="sm" className="size-3.25" />
        </span>
      </div>
      <div aria-hidden className="flex h-10 items-center gap-2.5 px-3">
        <Skeleton shape="sm" className="size-3.25" />
        <Skeleton shape="sm" className="h-3 w-24" />
      </div>
    </CalendarAccountList>
  );
}
