import type * as React from 'react';

import { cn } from '../lib/utils';

/**
 * DiffStat — how much a change touches, as git prints it: `+612 −248` in
 * mono, the additions green and the deletions red. A side that is zero is
 * left out (`+236`, `−96`), so the pair never reads `+0`. It sits in a
 * queue row, a file's header, a tree row and the Changes tab alike.
 */
function DiffStat({
  additions,
  deletions,
  className,
  ...props
}: Omit<React.ComponentProps<'span'>, 'children'> & { additions: number; deletions: number }) {
  return (
    <span
      data-slot="diff-stat"
      className={cn('figures inline-flex shrink-0 items-baseline gap-1.5 text-xs whitespace-nowrap', className)}
      {...props}
    >
      {additions > 0 ? <span className="text-success">+{additions}</span> : null}
      {deletions > 0 ? <span className="text-danger">−{deletions}</span> : null}
    </span>
  );
}

export { DiffStat };
