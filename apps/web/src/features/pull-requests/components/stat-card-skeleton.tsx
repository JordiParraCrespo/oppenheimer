import { Skeleton, StatCard } from '@oppenheimer/design-system-web';

/** A figure's line under it, what it was the period before, not answered yet. */
export const DELTA_PLACEHOLDER = (
  <span className="flex h-4.25 items-center">
    <Skeleton shape="sm" className="h-2.5 w-20" />
  </span>
);

/** A stat card with its own label, its figure and delta to come. */
export function StatCardSkeleton({ label }: { label: string }) {
  return (
    <StatCard
      label={label}
      value={<Skeleton shape="sm" className="my-1 h-5 w-20" />}
      detail={DELTA_PLACEHOLDER}
    />
  );
}
