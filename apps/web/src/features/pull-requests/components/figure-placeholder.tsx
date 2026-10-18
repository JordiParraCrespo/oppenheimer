import { Skeleton } from '@oppenheimer/design-system-web';
import { cn } from '@oppenheimer/design-system-web/utils';

/**
 * A figure not answered yet, inline in its line: a bar the width of a short
 * number, where a `0` would be a claim the data has not made.
 */
export function FigurePlaceholder({ className }: { className?: string }) {
  return (
    <Skeleton shape="sm" className={cn('inline-block h-2.5 w-2 align-[-0.05em]', className)} />
  );
}
