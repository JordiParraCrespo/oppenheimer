import { Skeleton } from '@oppenheimer/design-system-web';
import { LoadingStatus } from '@oppenheimer/frontend-web';
import { SharedFrame } from './shared-frame';

/**
 * A shared session while its share is read: the page's bar with bars where
 * the name, its state and what the share allows go, over the terminal's
 * ground the grid (or its chat) opens on. No dot: a dot in a guessed state
 * would be a value the read has not given.
 */
export function SharedSessionSkeleton() {
  return (
    <SharedFrame
      title={
        <span className="flex h-5 items-center">
          <Skeleton shape="sm" className="h-3 w-36" />
        </span>
      }
      meta={
        <span className="flex h-4 items-center">
          <Skeleton shape="sm" className="h-2.5 w-14" />
        </span>
      }
      actions={<Skeleton shape="pill" className="h-5.5 w-20" />}
    >
      <div aria-busy className="flex min-h-0 flex-1 flex-col">
        <LoadingStatus />
      </div>
    </SharedFrame>
  );
}
