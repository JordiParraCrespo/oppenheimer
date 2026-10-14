'use client';

import { CheckIcon, ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import type * as React from 'react';

import { cn } from '../lib/utils';
import { IconButton } from './icon-button';

/**
 * What the agent cannot go on without (Chat Components, Decisions). A
 * blocking request takes the composer's place as a card: 18px radius on a
 * hairline, the request at 15px medium, what it would touch, then numbered
 * `ChoiceRow`s. The number keys pick a row, and only while focus is inside
 * the card, so typing elsewhere never answers for the person.
 *
 * - `ApprovalPanel`: may the agent do this? Recommended first, stop
 *   everything last; the detail is a command, a file, a tool or the app it
 *   would drive (`detail`).
 * - `QuestionPanel`: the agent asks; picking an option advances. Picked rows
 *   fill and take a check; the person may type their own answer instead.
 * - `ChoiceRow`: one numbered choice: an 18px ring with the number in mono,
 *   the label at 14px medium and its line in subtle ink. `tone` rings the
 *   number in the action blue (the recommended one) or red (stop).
 */
function DecisionCard({
  slot,
  title,
  aside,
  onPick,
  count,
  className,
  children,
}: {
  slot: string;
  title: React.ReactNode;
  aside?: React.ReactNode;
  onPick?: (index: number) => void;
  count: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the number keys are a shortcut to the buttons inside, which carry the roles.
    <div
      role="group"
      data-slot={slot}
      onKeyDown={(event) => {
        if (!onPick || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLInputElement) return;
        const n = Number(event.key);
        if (Number.isInteger(n) && n >= 1 && n <= count) {
          event.preventDefault();
          onPick(n - 1);
        }
      }}
      className={cn('flex flex-col gap-2.5 rounded-lg border border-border-subtle bg-card px-3.5 py-3', className)}
    >
      <div className="flex items-start gap-3">
        <span className="flex-1 text-[15px] leading-[1.35] font-medium text-fg">{title}</span>
        {aside}
      </div>
      {children}
    </div>
  );
}

function ChoiceRow({
  n,
  label,
  description,
  tone = 'default',
  selected = false,
  className,
  ...props
}: Omit<React.ComponentProps<'button'>, 'type' | 'children'> & {
  n: number;
  label: React.ReactNode;
  description?: React.ReactNode;
  tone?: 'default' | 'primary' | 'danger';
  selected?: boolean;
}) {
  return (
    <button
      type="button"
      data-slot="choice-row"
      aria-pressed={selected}
      className={cn(
        'flex w-full items-start gap-2.5 rounded-sm px-2 py-1.5 text-left text-fg outline-none transition-colors duration-instant hover:bg-hover-surface focus-visible:ring-2 focus-visible:ring-ring',
        selected && 'bg-hover-surface',
        className,
      )}
      {...props}
    >
      <span
        aria-hidden
        className={cn(
          'figures flex size-4.5 shrink-0 items-center justify-center rounded-pill border font-mono text-[11px]',
          selected
            ? 'border-fg bg-fg text-canvas'
            : tone === 'primary'
              ? 'border-primary text-primary'
              : tone === 'danger'
                ? 'border-danger text-danger'
                : 'border-border text-fg-muted',
        )}
      >
        {n}
      </span>
      <span className="min-w-0 flex-1 text-[14px] leading-[1.35]">
        <span className="font-medium">{label}</span>
        {description ? <span className="ml-1.5 text-[13px] text-fg-subtle">{description}</span> : null}
      </span>
      {selected ? <CheckIcon aria-hidden className="mt-0.5 size-3.5 shrink-0" /> : null}
    </button>
  );
}

type Choice = { label: React.ReactNode; description?: React.ReactNode; tone?: 'default' | 'primary' | 'danger' };

function ApprovalPanel({
  title,
  tool,
  position,
  detail,
  choices,
  onChoose,
  className,
}: {
  /** "Run this command?" */
  title: React.ReactNode;
  /** Who asks, after the title in subtle ink ("Bash"). */
  tool?: React.ReactNode;
  /** "1/2" when several requests wait, as a mono tag. */
  position?: React.ReactNode;
  /** `ApprovalCommand`, `ApprovalFile` or `ApprovalApp`. */
  detail?: React.ReactNode;
  choices: readonly Choice[];
  onChoose: (index: number) => void;
  className?: string;
}) {
  return (
    <DecisionCard
      slot="approval-panel"
      title={
        <>
          {title} {tool ? <span className="ml-1 text-[13px] font-normal text-fg-subtle">{tool}</span> : null}
        </>
      }
      aside={
        position ? (
          <span className="figures flex h-4.5 items-center rounded-xs bg-hover-surface px-1.5 font-mono text-[11px] text-fg-muted">
            {position}
          </span>
        ) : null
      }
      count={choices.length}
      onPick={onChoose}
      className={className}
    >
      {detail}
      <div className="flex flex-col gap-0.5">
        {choices.map((c, i) => (
          <ChoiceRow
            // biome-ignore lint/suspicious/noArrayIndexKey: the choices are numbered by place.
            key={i}
            n={i + 1}
            label={c.label}
            description={c.description}
            tone={c.tone}
            onClick={() => onChoose(i)}
          />
        ))}
      </div>
    </DecisionCard>
  );
}

/** The command an approval would run, on the hover wash in mono. */
function ApprovalCommand({ className, ...props }: React.ComponentProps<'pre'>) {
  return (
    <pre
      data-slot="approval-command"
      className={cn('m-0 rounded-sm bg-hover-surface px-2.5 py-2 font-mono text-[12.5px] leading-normal break-words whitespace-pre-wrap', className)}
      {...props}
    />
  );
}

/** The file an approval would read or change: its name over its folder in mono. */
function ApprovalFile({ name, folder }: { name: React.ReactNode; folder?: React.ReactNode }) {
  return (
    <div data-slot="approval-file" className="flex flex-col gap-0.5">
      <span className="text-[15px] font-medium">{name}</span>
      {folder ? <span className="font-mono text-[11.5px] text-fg-subtle">{folder}</span> : null}
    </div>
  );
}

/** The app computer use would drive: its mark on a tile, its name and what it may do. */
function ApprovalApp({ icon, name, description }: { icon: React.ReactNode; name: React.ReactNode; description?: React.ReactNode }) {
  return (
    <div data-slot="approval-app" className="flex items-center gap-2.5 rounded-sm bg-hover-surface px-2.5 py-2">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-xs bg-card text-fg-muted [&_svg]:size-3.5">{icon}</span>
      <span className="flex flex-col gap-px text-[13px]">
        <span className="font-medium">{name}</span>
        {description ? <span className="text-fg-muted">{description}</span> : null}
      </span>
    </div>
  );
}

type QuestionLabels = { previous: string; next: string; of: (n: number, total: number) => string };

function QuestionPanel({
  question,
  options,
  value,
  onValueChange,
  index,
  total,
  onPrevious,
  onNext,
  answer,
  foot,
  labels,
  className,
}: {
  question: React.ReactNode;
  options: readonly Choice[];
  value: number | null;
  onValueChange: (index: number) => void;
  /** Which question this is, from 0, of `total`; with both the stepper shows. */
  index?: number;
  total?: number;
  onPrevious?: () => void;
  onNext?: () => void;
  /** The free answer, a `Textarea` ("Or type your own answer…"). */
  answer?: React.ReactNode;
  /** The note and the buttons (Cancel, Next). */
  foot?: React.ReactNode;
  labels?: Partial<QuestionLabels>;
  className?: string;
}) {
  const label = { previous: 'Previous question', next: 'Next question', of: (n: number, t: number) => `${n} of ${t}`, ...labels };
  return (
    <DecisionCard
      slot="question-panel"
      title={question}
      aside={
        index !== undefined && total !== undefined && total > 1 ? (
          <span className="flex items-center gap-0.5 text-fg-muted">
            <IconButton size="sm" aria-label={label.previous} disabled={index === 0} onClick={onPrevious}>
              <ChevronLeftIcon />
            </IconButton>
            <span className="figures font-mono text-[11.5px]">{label.of(index + 1, total)}</span>
            <IconButton size="sm" aria-label={label.next} disabled={index === total - 1} onClick={onNext}>
              <ChevronRightIcon />
            </IconButton>
          </span>
        ) : null
      }
      count={options.length}
      onPick={onValueChange}
      className={className}
    >
      <div className="flex flex-col gap-0.5">
        {options.map((o, i) => (
          <ChoiceRow
            // biome-ignore lint/suspicious/noArrayIndexKey: the options are numbered by place.
            key={i}
            n={i + 1}
            label={o.label}
            description={o.description}
            selected={value === i}
            onClick={() => onValueChange(i)}
          />
        ))}
      </div>
      {answer}
      {foot ? <div className="flex items-center gap-2 text-[13px] text-fg-muted">{foot}</div> : null}
    </DecisionCard>
  );
}

export { ApprovalApp, ApprovalCommand, ApprovalFile, ApprovalPanel, ChoiceRow, QuestionPanel };
export type { Choice, QuestionLabels };
