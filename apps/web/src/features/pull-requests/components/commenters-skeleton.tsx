import { Skeleton } from '@oppenheimer/design-system-web';

/** The rail's Comments before the conversation answers: a commenter's row, twice. */
export function CommentersSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-3">
      {['w-24', 'w-20'].map((width) => (
        <div key={width} className="flex h-5.5 items-center gap-2.5">
          <Skeleton shape="pill" className="size-5.5" />
          <Skeleton shape="sm" className={`h-3 ${width}`} />
          <span className="flex-1" />
          <Skeleton shape="sm" className="h-2.5 w-16" />
        </div>
      ))}
    </div>
  );
}
