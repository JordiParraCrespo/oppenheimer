import type * as React from 'react';

import { Textarea } from '../components/textarea';
import { cn } from '../lib/utils';

/**
 * The one field a comment is written in (a review's comment, a comment on a
 * line): the system's `Textarea`, two lines up, where ⌘⏎ (Ctrl⏎) submits and
 * Esc cancels.
 */
function CommentField({
  value,
  onValueChange,
  onSubmit,
  onCancel,
  canSubmit = true,
  className,
  ...props
}: Omit<React.ComponentProps<'textarea'>, 'value' | 'onChange'> & {
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: () => void;
  onCancel?: () => void;
  /** Off while there is nothing to post; ⌘⏎ then does nothing. */
  canSubmit?: boolean;
}) {
  return (
    <Textarea
      rows={2}
      value={value}
      onChange={(event) => onValueChange(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          if (canSubmit) onSubmit();
        } else if (event.key === 'Escape' && onCancel) {
          event.preventDefault();
          onCancel();
        }
      }}
      className={cn('min-h-16 text-[13.5px] leading-normal', className)}
      {...props}
    />
  );
}

export { CommentField };
