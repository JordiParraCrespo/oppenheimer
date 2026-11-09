import { Skeleton } from '@oppenheimer/design-system-web';
import { LoadingStatus } from '@oppenheimer/frontend-web';

const LABELS = ['w-24', 'w-32', 'w-20'];
const DESCRIPTIONS = ['w-64', 'w-52', 'w-72'];

/**
 * The consent screen's scope list before the permission catalog answers: the
 * same bordered list with one row per requested scope (at most three), each a
 * label, its level's pill and a description line, at their lines' heights.
 */
export function ConsentScopesSkeleton({ count }: { count: number }) {
  const rows = Array.from({ length: Math.min(Math.max(count, 1), 3) }, (_, index) => index);
  return (
    <div aria-busy className="divide-y rounded-md border">
      <LoadingStatus />
      {rows.map((index) => (
        <div key={index} className="flex items-start gap-3 p-4">
          <div className="min-w-0 flex-1">
            <div className="flex h-5.5 items-center gap-2">
              <Skeleton shape="sm" className={`h-3.5 ${LABELS[index]}`} />
              <Skeleton shape="pill" className="h-4.5 w-12" />
            </div>
            <span className="flex h-4.5 items-center">
              <Skeleton shape="sm" className={`h-3 ${DESCRIPTIONS[index]}`} />
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
