'use client';

import { Switch as SwitchPrimitive } from '@base-ui/react/switch';

import { cn } from '../lib/utils';

/**
 * Switch — a setting that takes effect the moment it flips (Learn
 * automatically, a connector, a routine's Active, Notifications). A pill track
 * with a white knob on 2px of inset: 34×20 with a 16px knob (`md`, a settings
 * row), 30×18 with a 14px knob (`sm`, a popover's foot: Compare with previous
 * period). On is the action blue, off the neutral control grey; the knob and
 * the track move over 140ms.
 *
 * A setting a policy holds (a tool the template locks) is `disabled` with its
 * reason as the `title`: it still reads, at half strength, so the reader sees
 * what is on. A choice that waits for Save is a `Checkbox`, not a switch.
 *
 * ```tsx
 * <Switch checked={learn} onCheckedChange={setLearn} aria-label="Learn automatically" />
 * ```
 */
function Switch({
  size = 'md',
  className,
  ...props
}: SwitchPrimitive.Root.Props & { size?: 'sm' | 'md' }) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        'group/switch relative inline-flex shrink-0 cursor-pointer items-center rounded-pill bg-control p-0.5 outline-none transition-colors duration-fast ease-standard focus-visible:ring-3 focus-visible:ring-ring data-checked:bg-primary data-disabled:cursor-not-allowed data-disabled:opacity-50',
        'h-5 w-8.5 data-[size=sm]:h-4.5 data-[size=sm]:w-7.5',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="block size-4 rounded-pill bg-white transition-transform duration-fast ease-standard group-data-[size=sm]/switch:size-3.5 data-checked:translate-x-3.5 group-data-[size=sm]/switch:data-checked:translate-x-3"
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
