import { cn } from '../lib/utils';

/**
 * The corner a placeholder takes, so it has the shape of what it stands in
 * for. `md` (14px) is the default block; the rest are the system's own radii:
 *
 * - `sm` (10px): a sidebar row while the session list loads.
 * - `lg` (18px): a whole card, as Run history draws while its runs load.
 * - `pill`: a round mark, like the account avatar on Connect GitHub.
 * - `none`: a pane that fills its frame edge to edge (an opening session's
 *   terminal).
 */
const SHAPES = {
  none: 'rounded-none',
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  pill: 'rounded-pill',
} as const;

function Skeleton({
  className,
  shape = 'md',
  ...props
}: React.ComponentProps<'div'> & { shape?: keyof typeof SHAPES }) {
  return (
    <div
      data-slot="skeleton"
      className={cn('animate-pulse bg-track-off', SHAPES[shape], className)}
      {...props}
    />
  );
}

export { Skeleton };
