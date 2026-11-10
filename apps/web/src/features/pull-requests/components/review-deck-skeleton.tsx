import { Skeleton } from '@oppenheimer/design-system-web';
import { ReviewBriefSkeleton } from './review-brief-skeleton';

/** The deck while the queue is read: a card's frame, its title and its brief in outline. */
export function ReviewDeckSkeleton() {
  return (
    <div className="flex w-full flex-col gap-4" aria-hidden>
      <Skeleton shape="sm" className="h-2.5 w-24" />
      <div className="flex flex-col gap-6 rounded-xl bg-card p-6 sm:p-8">
        <div className="flex flex-col gap-3">
          <Skeleton shape="sm" className="h-2.5 w-48" />
          <Skeleton shape="sm" className="h-5 w-3/4" />
          <Skeleton shape="sm" className="h-2.5 w-40" />
        </div>
        <ReviewBriefSkeleton />
      </div>
    </div>
  );
}
