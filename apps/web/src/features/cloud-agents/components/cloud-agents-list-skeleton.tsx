import { Skeleton } from '@oppenheimer/design-system-web';
import { LoadingStatus } from '@oppenheimer/frontend-web';

/** The agents before they answer: three rows at the row's height, a bar for each name and age. */
export function CloudAgentsListSkeleton() {
  return (
    <div aria-busy className="flex flex-col gap-0.5 px-3">
      {['w-32', 'w-40', 'w-28'].map((width) => (
        <div key={width} aria-hidden className="flex h-[30px] items-center gap-[9px] px-2.5">
          <Skeleton shape="sm" className="size-3.5" />
          <Skeleton shape="sm" className={`h-3 ${width}`} />
          <Skeleton shape="sm" className="ml-auto h-3 w-6" />
        </div>
      ))}
      <LoadingStatus />
    </div>
  );
}
