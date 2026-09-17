'use client';

import { EyeIcon, EyeOffIcon } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/utils';
import { Input, type InputProps } from './input';

/**
 * PasswordInput — an Input that owns the show/hide toggle once, so no screen
 * rebuilds it. The eye sits in the trailing slot as a 24px ghost control; it is
 * `type="button"` so it never submits, `tabIndex={-1}` so tabbing goes field to
 * field, and its label flips between "Show password" and "Hide password".
 *
 * Everything else (`value`, `onChange`, `name`, `autoComplete`, `aria-invalid`,
 * `ref`) reaches the inner input, so it drops into React Hook Form like Input:
 *
 * ```tsx
 * <PasswordInput size="lg" autoComplete="current-password" {...register('password')} />
 * ```
 */
function PasswordInput({
  showLabel = 'Show password',
  hideLabel = 'Hide password',
  defaultVisible = false,
  className,
  ...props
}: Omit<InputProps, 'type' | 'trailing'> & {
  showLabel?: string;
  hideLabel?: string;
  defaultVisible?: boolean;
}) {
  const [visible, setVisible] = React.useState(defaultVisible);
  return (
    <Input
      type={visible ? 'text' : 'password'}
      autoComplete="current-password"
      className={cn('pr-2', className)}
      trailing={
        <button
          type="button"
          tabIndex={-1}
          aria-label={visible ? hideLabel : showLabel}
          aria-pressed={visible}
          onClick={() => setVisible((v) => !v)}
          className="inline-flex size-6 items-center justify-center rounded-pill text-fg-subtle transition-colors duration-fast hover:bg-hover-surface hover:text-fg"
        >
          {visible ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
        </button>
      }
      {...props}
    />
  );
}

export { PasswordInput };
