import {
  InboxCard,
  InboxCardActions,
  InboxCardBody,
  Skeleton,
} from '@oppenheimer/design-system-web';
import { LoadingStatus } from '@oppenheimer/frontend-web';

/**
 * The pane while the Inbox loads: the greeting's two lines and the card's
 * frame, each line a bar at its height. Whether there is an item at all is
 * not known yet, so the quieter shape, one card, stands in.
 */
export function InboxPaneSkeleton() {
  return (
    <div aria-busy className="flex flex-col gap-4.5 pt-6">
      <LoadingStatus />
      <div className="flex flex-col gap-1.5 pb-1.5" aria-hidden>
        <div className="flex h-8 items-center">
          <Skeleton className="h-6 w-64" />
        </div>
        <div className="flex h-5.5 items-center">
          <Skeleton className="h-4 w-80" />
        </div>
      </div>
      <InboxCard
        aria-hidden
        icon={null}
        from={<Skeleton className="h-3 w-40" />}
        title={<Skeleton className="my-1 h-4 w-72" />}
      >
        <InboxCardBody>
          <Skeleton className="h-4 w-full" />
        </InboxCardBody>
        <InboxCardActions leading={<Skeleton className="h-8.5 w-16 rounded-pill" />}>
          <Skeleton className="h-8.5 w-20 rounded-pill" />
        </InboxCardActions>
      </InboxCard>
    </div>
  );
}
