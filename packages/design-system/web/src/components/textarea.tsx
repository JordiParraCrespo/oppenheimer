import type * as React from 'react';

import { cn } from '../lib/utils';

/**
 * Textarea — the multi-line field at the 10px radius, 14px, sized to its
 * content from 88px up. Same focus and invalid treatment as Input.
 */
function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'flex field-sizing-content min-h-[88px] w-full resize-y rounded-sm border border-field-border bg-field px-3 py-2.5 text-operate text-fg transition-[border-color,box-shadow] duration-fast ease-standard outline-none placeholder:text-field-placeholder hover:border-border-strong focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger aria-invalid:focus-visible:ring-danger-surface',
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
