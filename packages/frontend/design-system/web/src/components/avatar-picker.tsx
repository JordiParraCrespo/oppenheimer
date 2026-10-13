'use client';

import { Toggle as TogglePrimitive } from '@base-ui/react/toggle';
import { ToggleGroup as ToggleGroupPrimitive } from '@base-ui/react/toggle-group';
import type * as React from 'react';

import { cn } from '../lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from './avatar';

type AvatarOption = {
  id: string;
  /** The accessible name and title ("Photo 7"). */
  name: string;
  image?: string;
  initials: string;
  /** The caption under the photo; left out, the grid shows photos only. */
  caption?: string;
};

/** A bot's photo in ink: initials until the image loads, never a tint. */
function BotAvatar({ option, size }: { option: Pick<AvatarOption, 'image' | 'initials'>; size: number }) {
  return (
    <Avatar size={size} className="bg-control font-semibold tracking-[-0.01em] text-fg">
      {option.image ? <AvatarImage src={option.image} alt="" /> : null}
      <AvatarFallback>{option.initials}</AvatarFallback>
    </Avatar>
  );
}

/**
 * AvatarPicker — a bot's photo, picked from a set (the export's portraits).
 * A preview of the current one with the bot's name over a note, then the
 * photos as a grid of 10px-radius cells, each a round photo over an
 * optional 11.5px caption, the picked one on the selected wash. Arrow keys
 * move through the grid. `onShuffle` adds Surprise me, a 30px pill under
 * the grid.
 *
 * Two layouts, one per surface:
 * - `compact` (default): inside the 300px popover off the chat header's
 *   photo: four columns of 36px photos, a 56px preview.
 * - `wide`: on BotSettings' Profile: as many 76px columns as fit, 40px
 *   photos, a 72px preview beside the grid.
 *
 * ```tsx
 * <Popover><PopoverTrigger …/><PopoverContent className="w-75">
 *   <AvatarPicker options={photos} value={photo} onValueChange={setPhoto} name="Release Bot" onShuffle={shuffle} />
 * </PopoverContent></Popover>
 * ```
 */
function AvatarPicker({
  options,
  value,
  onValueChange,
  name,
  note,
  onShuffle,
  layout = 'compact',
  labels,
  className,
}: {
  options: AvatarOption[];
  value: string;
  onValueChange: (value: string) => void;
  /** The bot's name, beside the preview. */
  name?: React.ReactNode;
  /** The line under the name ("Shown in the sidebar and the chat"). */
  note?: React.ReactNode;
  onShuffle?: () => void;
  layout?: 'compact' | 'wide';
  labels?: { photo?: string; shuffle?: string };
  className?: string;
}) {
  const current = options.find((o) => o.id === value) ?? options[0];
  const wide = layout === 'wide';
  const preview = current ? (
    <div className={cn('flex shrink-0 items-center gap-3.5 py-0.5', wide && 'flex-col gap-2 py-0')}>
      <BotAvatar option={current} size={wide ? 72 : 56} />
      {name || note || wide ? (
        <span className={cn('flex flex-col gap-0.5', wide && 'items-center text-center')}>
          {name ? <span className="text-[14px] font-medium">{name}</span> : null}
          {note ? <span className="text-[12.5px] text-fg-muted">{note}</span> : null}
          {wide && !name ? <span className="text-[14px]">{current.name}</span> : null}
        </span>
      ) : null}
    </div>
  ) : null;

  return (
    <div
      data-slot="avatar-picker"
      data-layout={layout}
      className={cn('flex gap-3.5', wide ? 'items-start gap-10' : 'flex-col', className)}
    >
      {preview}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <span className="text-[12px] text-fg-muted">{labels?.photo ?? 'Photo'}</span>
        <ToggleGroupPrimitive
          value={[value]}
          onValueChange={(next) => {
            const picked = next.find((v) => v !== value);
            if (typeof picked === 'string') onValueChange(picked);
          }}
          aria-label={labels?.photo ?? 'Photo'}
          className={cn('grid gap-1', wide ? 'grid-cols-[repeat(auto-fill,minmax(76px,1fr))]' : 'grid-cols-4')}
        >
          {options.map((option) => (
            <TogglePrimitive
              key={option.id}
              value={option.id}
              aria-label={option.name}
              title={option.name}
              className="flex min-w-0 flex-col items-center gap-1.25 rounded-sm px-0.5 pt-2 pb-1.5 text-fg outline-none transition-colors duration-instant hover:bg-hover-surface focus-visible:ring-2 focus-visible:ring-ring data-pressed:bg-selected-surface data-pressed:hover:bg-selected-surface"
            >
              <BotAvatar option={option} size={wide ? 40 : 36} />
              {option.caption ? (
                <span className="max-w-full truncate text-[11.5px] text-fg-muted">{option.caption}</span>
              ) : null}
            </TogglePrimitive>
          ))}
        </ToggleGroupPrimitive>
        {onShuffle ? (
          <button
            type="button"
            onClick={onShuffle}
            className="mt-1.5 inline-flex h-7.5 items-center justify-center gap-1.5 rounded-pill bg-hover-surface text-[13px] text-fg outline-none transition-[background-color,transform] duration-instant hover:bg-control-hover active:scale-[0.975] focus-visible:ring-2 focus-visible:ring-ring"
          >
            {labels?.shuffle ?? 'Surprise me'}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export { AvatarPicker, BotAvatar };
export type { AvatarOption };
