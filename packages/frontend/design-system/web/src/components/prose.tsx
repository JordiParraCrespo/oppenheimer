import type * as React from 'react';

import { cn } from '../lib/utils';

/**
 * Prose — long-form text someone else wrote, rendered from markdown: a pull
 * request's description, a release note. The system's voice for reading:
 * 15px at 1.6 on a 72ch measure, section heads at 17px semibold with room
 * above, lists with their bullets, inline code and `pre` blocks in mono on
 * the card, links in the link blue. It styles the elements inside it, so
 * the markdown renderer's output needs no classes.
 */
function Prose({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="prose"
      className={cn(
        'max-w-[72ch] text-body leading-[1.6] text-pretty text-fg',
        '[&_h1]:mt-0 [&_h1]:mb-4 [&_h1]:font-display [&_h1]:text-h2 [&_h1]:font-semibold',
        '[&_h2]:mt-7 [&_h2]:mb-2.5 [&_h2]:text-h4 [&_h2]:font-semibold [&_h3]:mt-5 [&_h3]:mb-2 [&_h3]:text-body [&_h3]:font-semibold',
        '[&_p]:my-2.5 [&_ul]:my-2.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1',
        '[&_a]:text-link [&_a:hover]:underline',
        '[&_code]:rounded-xs [&_code]:bg-hover-surface [&_code]:px-1 [&_code]:py-px [&_code]:font-mono [&_code]:text-[0.88em]',
        '[&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-card [&_pre]:px-3.5 [&_pre]:py-3 [&_pre]:font-mono [&_pre]:text-xs [&_pre]:leading-[1.6]',
        '[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-[length:inherit]',
        '[&>*:first-child]:mt-0',
        className,
      )}
      {...props}
    />
  );
}

export { Prose };
