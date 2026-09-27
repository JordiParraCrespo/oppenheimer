'use client';

import { Tabs as TabsPrimitive } from '@base-ui/react/tabs';
import { CheckIcon } from 'lucide-react';

import { cn } from '../lib/utils';

/**
 * StepTabs — the automation editor's three steps as a segmented strip under
 * the dialog's title: Task, Trigger, Where it runs
 * (`design/version1/SessionsConsole.dc.html`). A pill track on the hover
 * wash with 3px of inset; each step is a 30px tab with a 16px round number
 * in mono before its name. The open step lifts onto the popover colour; a
 * finished step turns its number into a check on the success green; a step
 * not yet reachable is disabled rather than hidden, so the strip never
 * reflows.
 *
 * A wizard, not a view switch: the footer's Next is what moves forward, and
 * a tab is only there to go back or to skip ahead once everything before it
 * is done. Values are the step's index as a string.
 *
 * ```tsx
 * <StepTabs value={step} onValueChange={setStep}>
 *   <StepTabsList aria-label="Automation steps">
 *     <StepTab value="0" number={1} done>Task</StepTab>
 *     <StepTab value="1" number={2}>Trigger</StepTab>
 *     <StepTab value="2" number={3} disabled>Where it runs</StepTab>
 *   </StepTabsList>
 *   <StepTabsPanel value="0">…</StepTabsPanel>
 * </StepTabs>
 * ```
 */
function StepTabs({
  className,
  onValueChange,
  ...props
}: Omit<TabsPrimitive.Root.Props, 'onValueChange' | 'value' | 'defaultValue'> & {
  value: string;
  onValueChange: (value: string) => void;
}) {
  return (
    <TabsPrimitive.Root
      data-slot="step-tabs"
      className={cn('flex flex-col', className)}
      onValueChange={(next) => {
        if (typeof next === 'string') onValueChange(next);
      }}
      {...props}
    />
  );
}

function StepTabsList({ className, ...props }: TabsPrimitive.List.Props) {
  return (
    <TabsPrimitive.List
      data-slot="step-tabs-list"
      className={cn('flex gap-0.5 rounded-pill bg-hover-surface p-[3px]', className)}
      {...props}
    />
  );
}

function StepTab({
  number,
  done,
  className,
  children,
  ...props
}: TabsPrimitive.Tab.Props & {
  number: number;
  /** The step is filled in; its number reads as a check. */
  done?: boolean;
}) {
  return (
    <TabsPrimitive.Tab
      data-slot="step-tab"
      data-done={done || undefined}
      className={cn(
        'group/step flex h-[30px] flex-1 items-center justify-center gap-[7px] rounded-pill px-3 text-[13px] whitespace-nowrap text-fg-muted outline-none transition-[background-color,color,opacity] duration-fast ease-standard focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 disabled:cursor-default disabled:opacity-60 data-active:bg-popover data-active:text-fg',
        className,
      )}
      {...props}
    >
      <span
        aria-hidden
        className={cn(
          'figures flex size-4 items-center justify-center rounded-pill font-mono text-[10.5px] transition-colors duration-fast ease-standard',
          done
            ? 'bg-success text-popover'
            : 'bg-border-subtle text-fg-muted group-data-active/step:bg-fg group-data-active/step:text-popover',
        )}
      >
        {done ? <CheckIcon className="size-2.5 stroke-[3]" /> : number}
      </span>
      {children}
    </TabsPrimitive.Tab>
  );
}

function StepTabsPanel({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="step-tabs-panel"
      className={cn('flex flex-col gap-5 outline-none', className)}
      {...props}
    />
  );
}

export { StepTab, StepTabs, StepTabsList, StepTabsPanel };
