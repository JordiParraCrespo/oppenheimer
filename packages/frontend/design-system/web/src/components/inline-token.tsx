'use client';

import { ChevronDownIcon, PlusIcon, XIcon } from 'lucide-react';
import type * as React from 'react';

import { cn } from '../lib/utils';

/**
 * InlineToken — a trigger reads as a sentence, and every variable part is
 * a token you click to change, so there is no separate form to decode:
 * "Every [weekday] at [09:00]". A 30px pill on the card colour, 14px; a
 * `mono` token holds a value a human compares (a time, a branch); `dirty`
 * turns it blue on the selected wash while it differs from what was
 * saved; `open` holds the ring while its popover is up.
 *
 * `TokenSentence` is the line the tokens sit in, muted 14px text between
 * them. `TriggerCard` is the band a trigger lives in inside the editor,
 * with its glyph, the sentence, a remove button, and the preview line
 * under it. `WeekdayStrip` is that preview for a weekly schedule; `AddRow`
 * the dashed "Add trigger" button under the cards.
 */
function InlineToken({
  mono,
  dirty,
  open,
  chevron = true,
  size = 'md',
  className,
  children,
  ...props
}: React.ComponentProps<'button'> & {
  mono?: boolean;
  dirty?: boolean;
  open?: boolean;
  chevron?: boolean;
  /** `sm` is the 28px form in a filter row. */
  size?: 'md' | 'sm';
}) {
  return (
    <button
      type="button"
      data-slot="inline-token"
      data-mono={mono || undefined}
      data-dirty={dirty || undefined}
      data-popup-open={open ? '' : undefined}
      aria-expanded={open}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-pill whitespace-nowrap text-fg outline-none transition-[background-color,box-shadow,transform] duration-fast ease-standard hover:bg-control-hover focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 active:scale-[0.975] data-popup-open:bg-selected-surface data-popup-open:ring-3 data-popup-open:ring-ring data-dirty:bg-selected-surface data-dirty:text-link',
        size === 'md' ? 'h-[30px] bg-card px-[11px] text-sm tracking-[-0.006em]' : 'h-7 bg-hover-surface px-2.5 text-[13px]',
        mono && (size === 'md' ? 'figures text-[13px]' : 'figures text-[12.5px]'),
        className,
      )}
      {...props}
    >
      <span key={String(children)} className="motion-safe:animate-label-in">
        {children}
      </span>
      {chevron ? <ChevronDownIcon className="size-3 text-fg-subtle" aria-hidden /> : null}
    </button>
  );
}

function TokenSentence({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="token-sentence"
      className={cn('flex min-w-0 flex-1 flex-wrap items-center gap-1.5 text-sm text-fg-muted', className)}
      {...props}
    />
  );
}

function TriggerCard({
  icon,
  onRemove,
  removeLabel = 'Remove trigger',
  preview,
  className,
  children,
  ...props
}: React.ComponentProps<'div'> & {
  icon: React.ReactNode;
  onRemove?: () => void;
  removeLabel?: string;
  /** The line under the sentence: next run, weekday strip, live matches. */
  preview?: React.ReactNode;
}) {
  return (
    <div
      data-slot="trigger-card"
      className={cn('flex flex-col gap-2.5 rounded-md bg-hover-surface px-2 pt-2 pb-3', className)}
      {...props}
    >
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden
          className="flex size-[30px] shrink-0 items-center justify-center rounded-pill bg-card text-fg [&_svg:not([class*=size-])]:size-3.5"
        >
          {icon}
        </span>
        {children}
        {onRemove ? (
          <button
            type="button"
            aria-label={removeLabel}
            onClick={onRemove}
            className="flex size-7 shrink-0 items-center justify-center rounded-pill text-fg-subtle transition-colors duration-fast hover:bg-card hover:text-fg"
          >
            <XIcon className="size-3.5" />
          </button>
        ) : null}
      </div>
      {preview ? (
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 pl-10 text-[12.5px] text-fg-muted">{preview}</div>
      ) : null}
    </div>
  );
}

/** Mono value inside a preview line ("Mon 28 Sep, 08:30"). */
function TokenMono({ className, ...props }: React.ComponentProps<'span'>) {
  return <span className={cn('figures text-xs text-fg', className)} {...props} />;
}

/** The green dot before a live preview ("Listening on xrp-mobile …"). */
function TokenLiveDot() {
  return <span aria-hidden className="size-1.5 shrink-0 rounded-pill bg-success" />;
}

function WeekdayStrip({
  days,
  className,
  ...props
}: React.ComponentProps<'div'> & {
  days: { label: string; fires?: boolean; next?: boolean }[];
}) {
  return (
    <div data-slot="weekday-strip" className={cn('mr-1 flex gap-[3px]', className)} {...props}>
      {days.map((day, i) => (
        <span
          key={`${i}-${day.label}`}
          data-fires={day.fires || undefined}
          data-next={day.next || undefined}
          className={cn(
            'flex size-5 items-center justify-center rounded-pill text-[10px] font-medium transition-colors duration-base',
            day.fires ? 'bg-fg text-card' : 'bg-card text-fg-subtle',
            day.next && 'ring-2 ring-ring',
          )}
        >
          {day.label}
        </span>
      ))}
    </div>
  );
}

/** The dashed 42px pill under a list: "Add trigger", "Add another trigger". */
function AddRow({ open, className, children, ...props }: React.ComponentProps<'button'> & { open?: boolean }) {
  return (
    <button
      type="button"
      data-slot="add-row"
      data-popup-open={open ? '' : undefined}
      aria-expanded={open}
      className={cn(
        'flex h-(--control-h-lg) w-full items-center gap-2 rounded-pill border border-dashed border-border px-3.5 text-sm text-fg-muted outline-none transition-colors duration-fast ease-standard hover:bg-hover-surface hover:text-fg focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 data-popup-open:bg-hover-surface data-popup-open:text-fg',
        className,
      )}
      {...props}
    >
      <PlusIcon className="size-3.5" aria-hidden />
      {children}
    </button>
  );
}

export { AddRow, InlineToken, TokenLiveDot, TokenMono, TokenSentence, TriggerCard, WeekdayStrip };
