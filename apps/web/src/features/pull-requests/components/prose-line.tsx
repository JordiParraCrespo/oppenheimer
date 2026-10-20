import { Skeleton } from '@oppenheimer/design-system-web';

/** A line of prose not answered yet: a bar of `width` at the height of a body line. */
export function ProseLine({ width }: { width: string }) {
  return (
    <div className="flex h-5.5 items-center">
      <Skeleton shape="sm" className={`h-3 ${width}`} />
    </div>
  );
}
