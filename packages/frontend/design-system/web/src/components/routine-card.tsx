'use client';

import { PencilIcon, PlayIcon, XIcon } from 'lucide-react';
import type * as React from 'react';

import { cn } from '../lib/utils';
import { IconButton } from './icon-button';
import { Switch } from './switch';

type RoutineCardLabels = {
  active: string;
  pause: string;
  resume: string;
  run: string;
  running: string;
  edit: string;
  delete: string;
  last: string;
  next: string;
};

const DEFAULT_LABELS: RoutineCardLabels = {
  active: 'Active',
  pause: 'Pause',
  resume: 'Resume',
  run: 'Run now',
  running: 'Running…',
  edit: 'Edit routine',
  delete: 'Delete routine',
  last: 'Last',
  next: 'Next',
};

/**
 * RoutineCard — something a bot does on its own, on a schedule or a
 * trigger, as a card on its settings' Routines page. `RoutineItem` is the
 * console sidebar's row for a workspace automation; this is the bot's own,
 * read in full.
 *
 * Read: the name at 14.5px, the `Switch` (Pause / Resume as its title) and
 * the run, edit and delete buttons on the right (run is held while
 * `running`, its label saying so); the trigger as a 12px glyph and
 * "Schedule · Weekdays at 09:00"; what it is told to do in muted ink; when
 * it last and next ran in mono. A paused card fades to 60%.
 *
 * Edit: pass the form as `children` and the card holds it instead of the
 * read view (name, trigger kind, when, prompt, Save routine and Cancel are
 * the caller's fields).
 */
function RoutineCard({
  name,
  icon,
  trigger,
  prompt,
  last,
  next,
  active,
  onActiveChange,
  onRun,
  running = false,
  onEdit,
  onDelete,
  labels,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<'div'>, 'children'> & {
  name: React.ReactNode;
  /** The trigger kind's glyph (a clock, a webhook, a bolt). */
  icon?: React.ReactNode;
  /** "Schedule · Weekdays at 09:00". */
  trigger: React.ReactNode;
  prompt?: React.ReactNode;
  last?: React.ReactNode;
  next?: React.ReactNode;
  active: boolean;
  onActiveChange?: (active: boolean) => void;
  /** Run it once now, paused or not. */
  onRun?: () => void;
  /** A run is going: Run now waits for it. */
  running?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  labels?: Partial<RoutineCardLabels>;
  /** The edit form; present, it replaces the read view. */
  children?: React.ReactNode;
}) {
  const label = { ...DEFAULT_LABELS, ...labels };
  const editing = children !== undefined && children !== null && children !== false;
  return (
    <div
      data-slot="routine-card"
      data-paused={(!active && !editing) || undefined}
      className={cn(
        'flex flex-col gap-3 rounded-lg bg-card py-4 pr-4 pl-5 transition-opacity duration-fast data-paused:opacity-60',
        className,
      )}
      {...props}
    >
      {editing ? (
        children
      ) : (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-3">
            <span className="min-w-0 flex-1 truncate text-[14.5px] font-medium text-fg">{name}</span>
            {onActiveChange ? (
              <Switch
                checked={active}
                onCheckedChange={onActiveChange}
                aria-label={label.active}
                title={active ? label.pause : label.resume}
              />
            ) : null}
            {onRun ? (
              <IconButton
                size="sm"
                aria-label={running ? label.running : label.run}
                title={running ? label.running : label.run}
                disabled={running}
                onClick={onRun}
              >
                <PlayIcon />
              </IconButton>
            ) : null}
            {onEdit ? (
              <IconButton size="sm" aria-label={label.edit} onClick={onEdit}>
                <PencilIcon />
              </IconButton>
            ) : null}
            {onDelete ? (
              <IconButton size="sm" aria-label={label.delete} onClick={onDelete}>
                <XIcon />
              </IconButton>
            ) : null}
          </div>
          <span className="inline-flex items-center gap-1.5 text-[12.5px] text-fg-muted [&_svg]:size-3 [&_svg]:shrink-0">
            {icon}
            {trigger}
          </span>
          {prompt ? <span className="text-[13.5px] leading-normal text-pretty text-fg-muted">{prompt}</span> : null}
          {last || next ? (
            <span className="figures flex gap-4 font-mono text-[11.5px] text-fg-subtle">
              {last ? (
                <span>
                  {label.last} {last}
                </span>
              ) : null}
              {next ? (
                <span>
                  {label.next} {next}
                </span>
              ) : null}
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
}

export { RoutineCard };
export type { RoutineCardLabels };
