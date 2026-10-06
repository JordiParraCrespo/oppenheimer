/**
 * Which closed pull requests one Analytics read takes in full (#247). Every
 * repository's newest page is listed, since nothing short of listing proves a
 * repository closed nothing in the window; then the newest `limit` across all
 * of them are kept, so one busy repository cannot spend the ceiling. The read
 * is complete only if nothing was cut and no listed page may have more behind it.
 */
export interface ClosedListing<T> {
  /** The listed pull requests, newest update first, as GitHub lists them. */
  pulls: readonly T[];
  /** The page was full: GitHub has more closed pull requests behind it. */
  full: boolean;
}

export interface ClosedPlan<T> {
  /** For each listing, in order, the pull requests to read in full. */
  picks: T[][];
  complete: boolean;
}

export function planClosedReads<T>(
  listings: readonly ClosedListing<T>[],
  closedAt: (pull: T) => string,
  since: Date,
  limit: number,
): ClosedPlan<T> {
  const inWindow = listings.map((listing) =>
    listing.pulls.filter((pull) => new Date(closedAt(pull)) >= since),
  );
  const newest = inWindow
    .flatMap((pulls, listing) => pulls.map((pull) => ({ pull, listing, at: closedAt(pull) })))
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, limit);
  const picks = listings.map((_, index) =>
    newest.filter((entry) => entry.listing === index).map((entry) => entry.pull),
  );
  const total = inWindow.reduce((sum, pulls) => sum + pulls.length, 0);
  // A full page whose last pull request is still in the window may hide more that are.
  const truncated = listings.some((listing, index) => {
    const last = listing.pulls.at(-1);
    return listing.full && last !== undefined && (inWindow[index]?.includes(last) ?? false);
  });
  return { picks, complete: total <= limit && !truncated };
}
