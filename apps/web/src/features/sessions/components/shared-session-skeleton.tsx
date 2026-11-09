import { Skeleton } from '@oppenheimer/design-system-web';
import { LoadingStatus } from '@oppenheimer/frontend-web';

/**
 * A shared session while its share is read, inside `SharedFrame`: the
 * session's bar at its 46px with bars where the name, its state and what the
 * share allows go, over the terminal's ground the grid (or its chat) opens
 * on. The bar is drawn by hand on `SessionPaneHeader`'s frame because that
 * header takes a run state, and a dot in a guessed state would be a value
 * the read has not given.
 */
export function SharedSessionSkeleton() {
  return (
    <div aria-busy className="flex min-h-0 flex-1 flex-col">
      <LoadingStatus />
      <div
        aria-hidden
        className="flex h-11.5 min-w-0 shrink-0 items-center gap-2.5 border-b border-border-subtle bg-card pr-3 pl-3.5"
      >
        <span className="flex h-5 items-center">
          <Skeleton shape="sm" className="h-3 w-36" />
        </span>
        <span className="flex h-4 items-center">
          <Skeleton shape="sm" className="h-2.5 w-14" />
        </span>
        <span className="flex-1" />
        <span className="flex h-4 items-center">
          <Skeleton shape="sm" className="h-2.5 w-20" />
        </span>
        <Skeleton shape="pill" className="h-5 w-20" />
      </div>
      <div className="min-h-0 flex-1 bg-term-bg" />
    </div>
  );
}
