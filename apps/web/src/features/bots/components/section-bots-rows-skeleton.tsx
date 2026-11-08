import { BotItemSkeleton, BotList, Skeleton } from '@oppenheimer/design-system-web';

/** As many rows as most sections hold, before this device has seen any. */
const UNKNOWN = 1;
/** The most rows a placeholder draws, however many the section last listed. */
const MOST = 8;

/**
 * A section's bots while they load, as many as it listed last time on this
 * device (`count`): that many `BotItemSkeleton` rows, or, for a section that
 * had none, a bar on the empty line's height. Before the first visit, one row.
 */
export function SectionBotsRowsSkeleton({ count }: { count: number | null }) {
  if (count === 0)
    return (
      <div aria-busy className="mx-3.5 mt-0.5 mb-2 flex h-4 items-center">
        <Skeleton shape="sm" className="h-2.5 w-40" />
      </div>
    );
  const rows = Array.from({ length: Math.min(count ?? UNKNOWN, MOST) }, (_, row) => `row-${row}`);
  return (
    <BotList aria-busy className="mx-1.5">
      {rows.map((key, row) => (
        <BotItemSkeleton key={key} index={row} />
      ))}
    </BotList>
  );
}
