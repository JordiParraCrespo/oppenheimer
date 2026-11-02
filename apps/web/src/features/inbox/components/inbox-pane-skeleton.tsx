import {
  InboxMessage,
  InboxMessageActions,
  InboxMessageBody,
  InboxToolbar,
  Skeleton,
} from '@oppenheimer/design-system-web';
import { LoadingStatus } from '@oppenheimer/frontend-web';

/**
 * The reading pane while the Inbox loads: the toolbar's frame and one
 * message, each line a bar at its height. Whether there is an item at all is
 * not known yet, so the quieter shape, one message, stands in.
 */
export function InboxPaneSkeleton() {
  return (
    <div aria-busy className="flex min-h-0 flex-1 flex-col">
      <LoadingStatus />
      <InboxToolbar aria-hidden>
        <Skeleton className="size-5" />
      </InboxToolbar>
      <InboxMessage
        aria-hidden
        icon={null}
        sender={<Skeleton className="my-0.5 h-3.5 w-32" />}
        meta={<Skeleton className="my-0.5 h-3 w-48" />}
        title={<Skeleton className="my-1 h-5 w-96 max-w-full" />}
      >
        <InboxMessageBody>
          <Skeleton className="my-1 h-4 w-full" />
        </InboxMessageBody>
        <InboxMessageActions leading={<Skeleton className="h-8.5 w-16 rounded-pill" />}>
          <Skeleton className="h-8.5 w-20 rounded-pill" />
        </InboxMessageActions>
      </InboxMessage>
    </div>
  );
}
