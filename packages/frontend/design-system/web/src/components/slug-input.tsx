'use client';

import { CheckIcon, XIcon } from 'lucide-react';
import type * as React from 'react';

import { cn } from '../lib/utils';
import { Input, type InputProps } from './input';

/**
 * SlugInput — an Input for an address that is checked as you type: the
 * workspace URL on CreateWorkspace. In the `PasswordInput` mould, it owns the
 * two things every such field rebuilds: the mono prefix inside the border
 * ("oppenheimer.dev/") and the trailing verdict, which cycles through
 * `checking` (a spinning ring), `ok` (a green check) and `taken` (a red ×).
 * The value itself is mono at 13px, like the address it becomes.
 *
 * A real check is a round trip, so show `checking` for at least a beat before
 * the verdict; a verdict that appears instantly reads as no check at all.
 * `taken` also marks the input invalid, so the field's red ring and error line
 * follow. Pair with `FieldDescription tone="success"` for the green hint.
 *
 * ```tsx
 * <SlugInput size="lg" prefix="oppenheimer.dev/" status={status} {...register('slug')} />
 * ```
 */
type SlugStatus = 'idle' | 'checking' | 'ok' | 'taken';

function SlugInput({
  prefix,
  status = 'idle',
  checkingLabel = 'Checking availability',
  okLabel = 'Available',
  takenLabel = 'Taken',
  inputClassName,
  ...props
}: Omit<InputProps, 'leading' | 'trailing' | 'prefix'> & {
  /** The fixed part of the address, in mono. */
  prefix?: React.ReactNode;
  status?: SlugStatus;
  checkingLabel?: string;
  okLabel?: string;
  takenLabel?: string;
}) {
  return (
    <Input
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      aria-invalid={status === 'taken' || props['aria-invalid']}
      inputClassName={cn('figures text-[13px]', inputClassName)}
      leading={
        prefix ? (
          <span className="figures text-[13px] whitespace-nowrap text-fg-subtle">{prefix}</span>
        ) : undefined
      }
      trailing={
        status === 'idle' ? undefined : (
          <span
            data-slot="slug-status"
            data-status={status}
            role="status"
            aria-label={
              status === 'checking' ? checkingLabel : status === 'ok' ? okLabel : takenLabel
            }
            className="flex size-4 items-center justify-center"
          >
            {status === 'checking' ? (
              <span
                aria-hidden
                className="size-3.5 rounded-pill border-[1.5px] border-border-strong border-t-primary motion-safe:animate-spin"
              />
            ) : status === 'ok' ? (
              <CheckIcon className="size-4 text-success" strokeWidth={2.5} aria-hidden />
            ) : (
              <XIcon className="size-4 text-danger" strokeWidth={2.5} aria-hidden />
            )}
          </span>
        )
      }
      {...props}
    />
  );
}

export { SlugInput };
export type { SlugStatus };
