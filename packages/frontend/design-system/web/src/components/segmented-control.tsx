'use client';

import { Toggle as TogglePrimitive } from '@base-ui/react/toggle';
import { ToggleGroup as ToggleGroupPrimitive } from '@base-ui/react/toggle-group';

import { cn } from '../lib/utils';

/**
 * SegmentedControl — two or three ways to read the same thing, one of them
 * always on: Command / Agent prompt in the Add host dialog. A pill on the
 * hover surface with 2px of inset; the active segment lifts onto the card
 * colour in full ink, the others sit muted. 11.5px, because it labels a panel
 * rather than acting on it. Never a form value: for that, `RadioGroup`.
 *
 * Exactly one segment is on, so the value is a string, not the primitive's
 * array.
 *
 * ```tsx
 * <SegmentedControl value={tab} onValueChange={setTab} aria-label="Format">
 *   <SegmentedControlItem value="cmd">Command</SegmentedControlItem>
 *   <SegmentedControlItem value="prompt">Agent prompt</SegmentedControlItem>
 * </SegmentedControl>
 * ```
 */
function SegmentedControl({
  value,
  onValueChange,
  className,
  ...props
}: Omit<ToggleGroupPrimitive.Props, 'value' | 'defaultValue' | 'onValueChange' | 'multiple'> & {
  value: string;
  onValueChange: (value: string) => void;
}) {
  return (
    <ToggleGroupPrimitive
      data-slot="segmented-control"
      value={[value]}
      onValueChange={(next) => {
        const picked = next[0];
        if (typeof picked === 'string' && picked !== value) onValueChange(picked);
      }}
      className={cn('inline-flex gap-0.5 rounded-pill bg-hover-surface p-0.5', className)}
      {...props}
    />
  );
}

function SegmentedControlItem({ className, ...props }: TogglePrimitive.Props) {
  return (
    <TogglePrimitive
      data-slot="segmented-control-item"
      className={cn(
        'rounded-pill px-[9px] py-[3px] text-[11.5px] leading-normal whitespace-nowrap text-fg-muted outline-none transition-[background-color,color] duration-fast ease-standard hover:text-fg focus-visible:ring-2 focus-visible:ring-ring data-pressed:bg-card data-pressed:text-fg',
        className,
      )}
      {...props}
    />
  );
}

export { SegmentedControl, SegmentedControlItem };
