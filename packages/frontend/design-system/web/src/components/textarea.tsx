import type * as React from 'react';

import { cn } from '../lib/utils';

/**
 * Textarea — the multi-line field at the 10px radius, 14px, sized to its
 * content from 88px up. Same focus and invalid treatment as Input.
 *
 * `variant="code"` is a file edited in place (a bot's SOUL.md and
 * INSTRUCTIONS.md): the 18px reading radius, mono at 13px on 1.65, 16px by
 * 18px of padding, and at least 320px tall, so a page of text reads as a page.
 */
function Textarea({
  className,
  variant = 'default',
  ...props
}: React.ComponentProps<'textarea'> & { variant?: 'default' | 'code' }) {
  return (
    <textarea
      data-slot="textarea"
      data-variant={variant}
      className={cn(
        'flex field-sizing-content w-full resize-y border border-field-border bg-field text-fg transition-[border-color,box-shadow] duration-fast ease-standard outline-none placeholder:text-field-placeholder hover:border-border-strong focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger aria-invalid:focus-visible:ring-danger-surface',
        variant === 'code'
          ? 'min-h-80 rounded-lg px-4.5 py-4 font-mono text-[13px] leading-[1.65]'
          : 'min-h-[88px] rounded-sm px-3 py-2.5 text-operate',
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
