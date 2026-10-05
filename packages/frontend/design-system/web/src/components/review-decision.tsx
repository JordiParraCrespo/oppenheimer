'use client';

import { BotIcon, ChevronDownIcon, XIcon } from 'lucide-react';
import type * as React from 'react';

import { CommentField } from '../internal/comment-field';
import { cn } from '../lib/utils';
import { Button } from './button';
import { IconButton } from './icon-button';
import { RadioGroup, RadioGroupItem } from './radio-group';

/**
 * Submitting a review: what the Submit review button opens, a 380px panel
 * in a `Popover`.
 *
 * - `ReviewDecision`: the verdicts as a radio list, each with its line of
 *   what it does (Comment; Approve and merge; Request changes, which sends
 *   the comments back to the session) on `RadioGroup`, the review comment
 *   (optional, the one comment field: ⌘⏎ submits), a
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
        <RadioGroup value={verdict} onValueChange={onVerdictChange} aria-label={labels.title ?? 'Review decision'}>
          {verdicts.map((option) => (
            <RadioGroupItem key={option.value} value={option.value} label={option.label} description={option.description} />
          ))}
        </RadioGroup>
      </div>
      <label className="flex flex-col gap-2">
        <span className="flex items-baseline gap-2">
          <span className="text-operate font-medium text-fg">{labels.comment ?? 'Review comment'}</span>
          <span className="flex-1" />
          <span className="text-xs text-fg-subtle">{labels.optional ?? 'Optional'}</span>
        </span>
        <CommentField
          value={comment}
          onValueChange={onCommentChange}
          placeholder={labels.placeholder ?? 'Anything to add for the author'}
          onSubmit={onSubmit}
          onCancel={onClose}
          canSubmit={!submitDisabled}
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
