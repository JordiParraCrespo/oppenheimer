'use client';

import { InfoIcon } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/utils';
import { ComposerToolButton } from './composer';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

/**
 * EffortSlider — how long the agent may think, as a stepped track rather
 * than a list: five stops from Minimal to Max, a 30px knob in full ink, the
 * used part of the track in the control-hover wash, a dot at every stop
 * the knob is not on. 28px tall at the 10px radius. Pointer picks and drags;
 * arrows, Home and End step. Picking stays put: the reader is comparing,
 * not confirming.
 *
 * `EffortPicker` is the composer's form of it: a muted tool button reading
 * the current stop, opening a 268px popover with the "Effort · Medium"
 * header, an info glyph explaining the trade, "Faster" and "Smarter" at the
 * ends, and the slider.
 */
type EffortStop = { value: string; label: string };

const DEFAULT_STOPS: EffortStop[] = [
  { value: 'minimal', label: 'Minimal' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'max', label: 'Max' },
];

const KNOB = 30;

function EffortSlider({
  stops = DEFAULT_STOPS,
  value,
  onValueChange,
  className,
  'aria-label': ariaLabel = 'Effort',
  ...props
}: Omit<React.ComponentProps<'div'>, 'onChange'> & {
  stops?: EffortStop[];
  value: string;
  onValueChange: (value: string) => void;
}) {
  const track = React.useRef<HTMLDivElement>(null);
  const index = Math.max(
    0,
    stops.findIndex((stop) => stop.value === value),
  );
  const last = stops.length - 1;

  function fromPointer(clientX: number) {
    const rect = track.current?.getBoundingClientRect();
    if (!rect || !rect.width) return null;
    const i = Math.floor(((clientX - rect.left) / rect.width) * stops.length);
    return stops[Math.max(0, Math.min(last, i))]?.value ?? null;
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    track.current?.setPointerCapture(event.pointerId);
    const next = fromPointer(event.clientX);
    if (next) onValueChange(next);
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!track.current?.hasPointerCapture(event.pointerId)) return;
    const next = fromPointer(event.clientX);
    if (next && next !== value) onValueChange(next);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const step =
      event.key === 'ArrowRight' || event.key === 'ArrowUp'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowDown'
          ? -1
          : event.key === 'Home'
            ? -stops.length
            : event.key === 'End'
              ? stops.length
              : 0;
    if (!step) return;
    event.preventDefault();
    const next = stops[Math.max(0, Math.min(last, index + step))];
    if (next) onValueChange(next.value);
  }

  // The knob travels the track minus its own width. Positioned with `left`
  // and sized with `width`, both of which read percentages against the
  // track; a transform would read them against the knob itself.
  const position = `calc((100% - ${KNOB}px) * ${last ? index / last : 0})`;

  return (
    <div
      ref={track}
      role="slider"
      tabIndex={0}
      aria-label={ariaLabel}
      aria-valuemin={1}
      aria-valuemax={stops.length}
      aria-valuenow={index + 1}
      aria-valuetext={stops[index]?.label}
      data-slot="effort-slider"
      data-effort={value}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onKeyDown={onKeyDown}
      className={cn(
        'relative h-7 cursor-pointer touch-none overflow-hidden rounded-sm bg-hover-surface outline-none select-none focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2',
        className,
      )}
      {...props}
    >
      <span
        aria-hidden
        data-slot="effort-fill"
        className="pointer-events-none absolute inset-y-0 left-0 rounded-sm bg-control-hover transition-[width] duration-fast ease-standard motion-reduce:transition-none"
        style={{ width: `calc(${position} + ${KNOB}px)` }}
      />
      <span aria-hidden className="pointer-events-none absolute inset-0">
        {stops.map((stop, i) => (
          <span
            key={stop.value}
            className={cn(
              'absolute top-1/2 size-1 -translate-x-1/2 -translate-y-1/2 rounded-pill bg-fg-subtle opacity-55 transition-opacity duration-fast',
              i === index && 'opacity-0',
            )}
            style={{ left: `calc((100% - ${KNOB}px) * ${last ? i / last : 0} + ${KNOB / 2}px)` }}
          />
        ))}
      </span>
      <span
        aria-hidden
        data-slot="effort-knob"
        className="pointer-events-none absolute inset-y-0 rounded-sm bg-fg transition-[left] duration-fast ease-standard motion-reduce:transition-none"
        style={{ width: KNOB, left: position }}
      />
    </div>
  );
}

function EffortPicker({
  stops = DEFAULT_STOPS,
  value,
  onValueChange,
  label = 'Effort',
  fasterLabel = 'Faster',
  smarterLabel = 'Smarter',
  hint = 'How long the agent may think before it answers. Higher effort costs more and takes longer.',
  disabled,
  className,
}: {
  stops?: EffortStop[];
  value: string;
  onValueChange: (value: string) => void;
  label?: string;
  fasterLabel?: string;
  smarterLabel?: string;
  hint?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const current = stops.find((stop) => stop.value === value) ?? stops[0];
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <ComposerToolButton tone="muted" open={open} disabled={disabled} className={className} aria-label={label}>
            {current?.label}
          </ComposerToolButton>
        }
      />
      <PopoverContent
        side="top"
        align="end"
        data-slot="effort-picker"
        className="flex w-[268px] flex-col gap-[11px] rounded-md border-0 bg-popover px-3.5 py-[13px] text-fg shadow-popover"
      >
        <div className="flex items-center gap-2 text-[13px]">
          <span className="text-fg-muted">{label}</span>
          <span key={value} className="motion-safe:animate-effort-in text-fg">
            {current?.label}
          </span>
          <span className="flex-1" />
          <span className="flex text-fg-subtle" title={hint}>
            <InfoIcon className="size-[15px]" aria-hidden />
          </span>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex justify-between text-xs text-fg-muted">
            <span>{fasterLabel}</span>
            <span>{smarterLabel}</span>
          </div>
          <EffortSlider stops={stops} value={value} onValueChange={onValueChange} aria-label={label} />
        </div>
      </PopoverContent>
    </Popover>
  );
}

export { DEFAULT_STOPS as EFFORT_STOPS, EffortPicker, EffortSlider };
export type { EffortStop };
