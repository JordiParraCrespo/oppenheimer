import { Input as InputPrimitive } from '@base-ui/react/input';
import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';

import { cn } from '../lib/utils';

/**
 * Input — anything you type into has a 10px radius. Sizes follow the shared
 * control ramp (28 / 34 / 42; `lg` is the auth forms). Focus is the blue border
 * plus a 3px `--ring` halo; invalid swaps both for red.
 *
 * The field is a flex shell around the native input so `leading` and
 * `trailing` slots (a search glyph, the password reveal) sit inside the border
 * without the text running under them. Every input prop, including `ref`, goes
 * to the inner `<input>`, so it drops into React Hook Form as-is; `className`
 * styles the shell.
 */
const inputVariants = cva(
  'group/input flex w-full min-w-0 items-center gap-2 rounded-sm border border-field-border bg-field text-fg transition-[border-color,box-shadow,background-color] duration-fast ease-standard hover:border-border-strong has-focus-visible:border-primary has-focus-visible:ring-3 has-focus-visible:ring-ring has-aria-invalid:border-danger has-aria-invalid:has-focus-visible:ring-danger-surface has-disabled:pointer-events-none has-disabled:bg-control has-disabled:opacity-50 [&_svg]:shrink-0 [&_svg:not([class*=size-])]:size-4',
  {
    variants: {
      size: {
        sm: 'h-(--control-h-sm) px-2.5 text-sm',
        md: 'h-(--control-h-md) px-3 text-operate',
        lg: 'h-(--control-h-lg) px-3.5 text-lg',
        // Legacy alias.
        default: 'h-(--control-h-md) px-3 text-operate',
      },
      pill: {
        true: 'rounded-pill px-3.5',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  },
);

type InputProps = Omit<React.ComponentProps<'input'>, 'size'> &
  VariantProps<typeof inputVariants> & {
    /** A glyph before the text, in the subtle colour. */
    leading?: React.ReactNode;
    /** A glyph or small control after the text. */
    trailing?: React.ReactNode;
    /** Class for the inner input rather than the shell. */
    inputClassName?: string;
  };

function Input({
  className,
  inputClassName,
  size = 'md',
  pill,
  leading,
  trailing,
  type,
  ...props
}: InputProps) {
  return (
    <div
      data-slot="input"
      data-size={size}
      className={cn(inputVariants({ size, pill }), className)}
    >
      {leading ? (
        <span data-slot="input-leading" className="flex shrink-0 text-fg-subtle">
          {leading}
        </span>
      ) : null}
      <InputPrimitive
        type={type}
        data-slot="input-control"
        className={cn(
          'min-w-0 flex-1 border-0 bg-transparent p-0 font-[inherit] text-inherit tracking-inherit outline-none placeholder:text-field-placeholder file:inline-flex file:border-0 file:bg-transparent file:font-medium file:text-fg disabled:cursor-not-allowed autofill:shadow-[inset_0_0_0_1000px_var(--field)] autofill:[-webkit-text-fill-color:var(--fg)]',
          inputClassName,
        )}
        {...props}
      />
      {trailing ? (
        <span data-slot="input-trailing" className="-mr-1 flex shrink-0 items-center text-fg-subtle">
          {trailing}
        </span>
      ) : null}
    </div>
  );
}

export { Input, inputVariants };
export type { InputProps };
