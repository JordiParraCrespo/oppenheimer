import type * as React from 'react';

import { cn } from '../lib/utils';

/**
 * Prose — long-form text someone else wrote, rendered from markdown: a pull
 * request's description, a release note. It reads the way the Codex desktop
 * app reads a description: 15px at 1.6 on a 72ch measure; headings in `em`
 * steps (1.5 · 1.25 · 1) with room above; paragraphs a line apart; lists
 * indented 1.625em with muted markers and half a line between items, task
 * lists as checkboxes; a quote behind a 4px rule; tables full width at
 * 0.875em with a strong rule under the header and hairlines between rows,
 * each column capped by `data-col-size`; code blocks bordered on the card
 * with room on the right for a copy button, their syntax in the Codex
 * app's colours (`--syntax-*`); inline code on a tint with a
 * hairline ring, and a key (`kbd`) as a ringed card; a `details` fold with
 * its summary at medium weight; links in the link blue. It styles the
 * elements inside it, so the markdown renderer's output needs no classes.
 */
function Prose({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="prose"
      className={cn(
        'max-w-[72ch] text-body leading-[1.6] text-pretty wrap-anywhere text-fg',
        '[&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
        // Headings
        '[&_h1]:mt-0 [&_h1]:mb-4 [&_h1]:font-display [&_h1]:text-h2 [&_h1]:font-semibold',
        '[&_h2]:mt-8 [&_h2]:mb-4 [&_h2]:text-[1.5em] [&_h2]:leading-[1.222] [&_h2]:font-semibold',
        '[&_h3]:mt-4.5 [&_h3]:mb-2.5 [&_h3]:text-[1.25em] [&_h3]:leading-[1.3] [&_h3]:font-semibold',
        '[&_h4]:mt-4 [&_h4]:mb-2 [&_h4]:font-semibold [&_h5]:font-semibold',
        // Paragraphs, emphasis, rules
        '[&_p]:my-[1em] [&_strong]:font-semibold [&_b]:font-semibold [&_em]:italic',
        '[&_hr]:my-[2em] [&_hr]:border-0 [&_hr]:border-t [&_hr]:border-border-subtle',
        // Lists
        '[&_:is(ul,ol)]:mt-[0.5em] [&_:is(ul,ol)]:mb-[1em] [&_:is(ul,ol)]:ps-[1.625em]',
        '[&_ul]:list-disc [&_ol]:list-decimal',
        '[&_li]:my-[0.5em] [&_li]:min-h-[1.5em] [&_li]:ps-[0.375em] [&_li]:marker:font-medium [&_li]:marker:text-fg-muted',
        '[&_li>*:first-child]:my-0 [&_li_:is(ul,ol)]:mt-[0.25em] [&_li_:is(ul,ol)]:mb-0',
        '[&_[data-task-list]]:ps-1 [&_[data-task-list]>li]:flex [&_[data-task-list]>li]:list-none [&_[data-task-list]>li]:items-baseline [&_[data-task-list]>li]:gap-2 [&_[data-task-list]>li]:ps-0',
        '[&_[data-task-list]_input]:m-0 [&_[data-task-list]_input]:flex-none [&_[data-task-list]_input]:accent-primary',
        // Quotes
        '[&_blockquote]:relative [&_blockquote]:py-1 [&_blockquote]:ps-6 [&_blockquote]:text-fg-muted',
        "[&_blockquote]:before:absolute [&_blockquote]:before:inset-y-0 [&_blockquote]:before:start-0 [&_blockquote]:before:w-1 [&_blockquote]:before:rounded-xs [&_blockquote]:before:bg-border [&_blockquote]:before:content-['']",
        '[&_blockquote_p]:mt-[0.5em] [&_blockquote_p]:mb-0 [&_blockquote_p:first-child]:mt-0',
        // Links and images
        '[&_a]:text-link [&_a:hover]:underline',
        '[&_img]:my-3 [&_img]:block [&_img]:h-auto [&_img]:max-h-[min(70vh,40rem)] [&_img]:max-w-full [&_img]:rounded-sm [&_img]:object-contain',
        // Inline code, then blocks
        '[&_code]:rounded-xs [&_code]:bg-hover-surface [&_code]:px-[0.3em] [&_code]:py-px [&_code]:font-mono [&_code]:text-[0.875em] [&_code]:font-medium [&_code]:ring-1 [&_code]:ring-border-subtle [&_code]:ring-inset',
        '[&_kbd]:rounded-xs [&_kbd]:bg-card [&_kbd]:px-[0.35em] [&_kbd]:py-px [&_kbd]:font-mono [&_kbd]:text-[0.8em] [&_kbd]:ring-1 [&_kbd]:ring-border [&_kbd]:ring-inset',
        '[&_pre]:my-4 [&_pre]:overflow-x-auto [&_pre]:rounded-sm [&_pre]:border [&_pre]:border-border-subtle [&_pre]:bg-card [&_pre]:py-3.5 [&_pre]:ps-4 [&_pre]:pe-10 [&_pre]:font-mono [&_pre]:text-xs [&_pre]:leading-normal',
        '[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:font-normal [&_pre_code]:text-[length:inherit] [&_pre_code]:ring-0',
        // Syntax: highlight.js's classes, grouped the way the Codex app colours them
        '[&_pre_:is(.hljs-comment,.hljs-quote)]:text-fg-muted [&_pre_:is(.hljs-comment,.hljs-quote)]:italic',
        '[&_pre_:is(.hljs-doctag,.hljs-keyword,.hljs-formula,.hljs-operator)]:text-syntax-keyword',
        '[&_pre_:is(.hljs-variable,.hljs-template-variable,.hljs-type,.hljs-title,.hljs-selector-class,.hljs-selector-pseudo)]:text-syntax-variable',
        '[&_pre_:is(.hljs-built_in,.hljs-title.class_,.hljs-class_.hljs-title,.hljs-literal,.hljs-number)]:text-syntax-literal',
        '[&_pre_:is(.hljs-string,.hljs-regexp,.hljs-addition,.hljs-meta-string)]:text-syntax-string',
        '[&_pre_:is(.hljs-attr,.hljs-attribute,.hljs-section,.hljs-selector-attr)]:text-syntax-attribute',
        '[&_pre_:is(.hljs-name,.hljs-selector-tag,.hljs-symbol,.hljs-bullet,.hljs-link,.hljs-meta,.hljs-selector-id)]:text-syntax-name',
        '[&_pre_.hljs-deletion]:text-danger',
        // Tables
        '[&_table]:my-[2em] [&_table]:w-full [&_table]:border-separate [&_table]:border-spacing-0 [&_table]:text-[0.875em] [&_table]:leading-[1.71429] [&_table]:tabular-nums',
        '[&_th]:border-b [&_th]:border-border-strong [&_th]:p-2 [&_th]:text-start [&_th]:font-semibold',
        '[&_td]:border-b [&_td]:border-border-subtle [&_td]:px-2 [&_td]:py-2.5 [&_tbody_tr:last-child_td]:border-b-0',
        '[&_:is(th,td):first-child]:ps-0 [&_:is(th,td):last-child]:pe-0',
        '[&_[data-col-size=sm]]:max-w-40 [&_[data-col-size=md]]:max-w-53 [&_[data-col-size=lg]]:max-w-80 [&_[data-col-size=xl]]:max-w-120',
        // Folds
        '[&_details]:my-[1em] [&_details>*:not(summary)]:ms-5',
        '[&_summary]:cursor-pointer [&_summary]:font-medium [&_summary]:marker:text-fg-muted',
        className,
      )}
      {...props}
    />
  );
}

export { Prose };
