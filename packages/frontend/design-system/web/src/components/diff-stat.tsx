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
      {diffStatParts(additions, deletions).map((part) => (
        <span key={part.side} className={part.side === 'additions' ? 'text-success' : 'text-danger'}>
          {part.text}
        </span>
      ))}
    </span>
  );
}

/** The stat's parts, as text: each side that is not zero, signed. The tree's rows print the same. */
function diffStatParts(additions: number, deletions: number) {
  return [
    additions > 0 ? { side: 'additions' as const, text: `+${additions}` } : null,
    deletions > 0 ? { side: 'deletions' as const, text: `−${deletions}` } : null,
  ].filter((part) => part !== null);
}

export { DiffStat, diffStatParts };
