import { Skeleton } from '@oppenheimer/design-system-web';
import { LoadingStatus } from '@oppenheimer/frontend-web';

/** Add undated tasks while the plan loads: the line, the search and four rows. */
export function UndatedPickerSkeleton() {
  return (
    <div aria-busy className="flex flex-col gap-4">
      <LoadingStatus />
      <span className="flex h-5 items-center">
        <Skeleton shape="sm" className="h-3 w-72 max-w-full" />
      </span>
      <Skeleton shape="sm" className="h-(--control-h-md) w-full" />
      {['w-56', 'w-40', 'w-64', 'w-48'].map((width) => (
        <span key={width} className="flex h-8 items-center px-2">
          <Skeleton shape="sm" className={`h-3 ${width} max-w-full`} />
        </span>
      ))}
    </div>
  );
}
