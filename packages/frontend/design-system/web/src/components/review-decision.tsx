'use client';

import { Radio as RadioPrimitive } from '@base-ui/react/radio';
import { RadioGroup as RadioGroupPrimitive } from '@base-ui/react/radio-group';
import { BotIcon, ChevronDownIcon, XIcon } from 'lucide-react';
import type * as React from 'react';

import { cn } from '../lib/utils';
import { Button } from './button';
import { IconButton } from './icon-button';

/**
 * Submitting a review: what the Submit review button opens, a 380px panel
 * in a `Popover`.
 *
 * - `ReviewDecision`: the verdicts as a radio list, each with its line of
 *   what it does (Comment; Approve and merge; Request changes, which sends
 *   the comments back to the session), the review comment (optional), a
 *   note on what posts with it, and the foot: Discard the pending comments,
 *   close, and the primary button named for the verdict.
 * - `SubmitReviewButton`: the trigger, primary, with how many comments are
 *   pending after a dot, in mono, and the chevron that says it opens.
 */

interface ReviewVerdict {
  value: string;
  label: React.ReactNode;
  description?: React.ReactNode;
}

function ReviewDecision({
  verdicts,
  verdict,
  onVerdictChange,
  comment,
  onCommentChange,
  agentNote,
  note,
  submitLabel,
  onSubmit,
  onDiscard,
  onClose,
  submitDisabled = false,
  labels = {},
  className,
}: {
  verdicts: readonly ReviewVerdict[];
  verdict: string;
  onVerdictChange: (value: string) => void;
  comment: string;
  onCommentChange: (value: string) => void;
  /** What the review agent adds, beside its glyph, under the comment. */
  agentNote?: React.ReactNode;
  /** "2 pending comments… Posts as @jordiparra." */
  note?: React.ReactNode;
  /** Named for the verdict: "Approve and merge". */
  submitLabel: React.ReactNode;
  onSubmit: () => void;
  /** Throws the pending comments away; absent when there are none. */
  onDiscard?: () => void;
  onClose?: () => void;
  submitDisabled?: boolean;
  labels?: { title?: string; comment?: string; optional?: string; placeholder?: string; discard?: string; close?: string };
  className?: string;
}) {
  return (
    <div data-slot="review-decision" className={cn('flex flex-col gap-3.5', className)}>
      <div className="flex flex-col gap-1">
        <span className="pb-1 text-operate font-medium text-fg">{labels.title ?? 'Review decision'}</span>
        <RadioGroupPrimitive
          value={verdict}
          onValueChange={(next) => onVerdictChange(String(next))}
          aria-label={labels.title ?? 'Review decision'}
          className="flex flex-col gap-1"
        >
          {verdicts.map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer items-start gap-3 rounded-sm px-2.5 py-[7px] transition-colors duration-instant ease-standard hover:bg-hover-surface has-data-checked:bg-selected-surface"
            >
              <RadioPrimitive.Root
                value={option.value}
                className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-pill border-[1.5px] border-border-strong outline-none focus-visible:ring-3 focus-visible:ring-ring data-checked:border-primary"
              >
                <RadioPrimitive.Indicator className="size-1.5 rounded-pill bg-primary" />
              </RadioPrimitive.Root>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-[13.5px] font-medium text-fg">{option.label}</span>
                {option.description ? (
                  <span className="text-xs leading-[1.4] text-pretty text-fg-muted">{option.description}</span>
                ) : null}
              </span>
            </label>
          ))}
        </RadioGroupPrimitive>
      </div>
      <label className="flex flex-col gap-2">
        <span className="flex items-baseline gap-2">
          <span className="text-operate font-medium text-fg">{labels.comment ?? 'Review comment'}</span>
          <span className="flex-1" />
          <span className="text-xs text-fg-subtle">{labels.optional ?? 'Optional'}</span>
        </span>
        <textarea
          rows={2}
          value={comment}
          placeholder={labels.placeholder ?? 'Anything to add for the author'}
          onChange={(event) => onCommentChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey) && !submitDisabled) {
              event.preventDefault();
              onSubmit();
            }
          }}
          className="min-h-16 w-full resize-y rounded-sm border border-border bg-background px-3 py-[9px] text-[13.5px] leading-normal text-fg outline-none placeholder:text-fg-subtle focus:border-primary focus:ring-3 focus:ring-ring"
        />
        {agentNote ? (
          <span className="flex items-start gap-1.5 text-xs leading-[1.45] text-fg-muted">
            <BotIcon className="mt-px size-3 shrink-0" aria-hidden />
            {agentNote}
          </span>
        ) : null}
      </label>
      {note ? <span className="text-xs leading-[1.45] text-pretty text-fg-muted">{note}</span> : null}
      <div className="flex flex-wrap items-center gap-2">
        {onDiscard ? (
          <Button variant="destructive-ghost" size="sm" onClick={onDiscard}>
            {labels.discard ?? 'Discard'}
          </Button>
        ) : null}
        <span className="flex-1" />
        {onClose ? (
          <IconButton size="sm" aria-label={labels.close ?? 'Close'} onClick={onClose}>
            <XIcon />
          </IconButton>
        ) : null}
        <Button size="sm" disabled={submitDisabled} onClick={onSubmit} title="⌘⏎">
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}

function SubmitReviewButton({
  count,
  className,
  children,
  ...props
}: React.ComponentProps<typeof Button> & { /** Pending comments. */ count?: number }) {
  return (
    <Button data-slot="submit-review-button" className={cn('whitespace-nowrap', className)} {...props}>
      {children}
      {count ? <span className="figures opacity-80">· {count}</span> : null}
      <ChevronDownIcon aria-hidden />
    </Button>
  );
}

export { ReviewDecision, SubmitReviewButton };
export type { ReviewVerdict };
