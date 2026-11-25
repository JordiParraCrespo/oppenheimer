'use client';

import * as React from 'react';

import { cn } from '../lib/utils';
import { BotAvatar, type BotFaceSpec } from './avatar-picker';
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip';

const FACE_SIZE = 20;

/** A press on a face or the chip opens or unfolds; it never lifts the section around them. */
const stopPress = (event: React.PointerEvent) => event.stopPropagation();
const FACE_GAP = 4;
/** How far apart the faces start their entrance, left to right. */
const FACE_STAGGER_MS = 30;

/** How many 20px faces, 4px apart, fit in `width`. */
function facesThatFit(width: number): number {
  return Math.max(0, Math.floor((width + FACE_GAP) / (FACE_SIZE + FACE_GAP)));
}

/**
 * BotFaces — the bots of a folded list, drawn in its heading as a row of
 * `BotFaceItem`s 4px apart, so the list folds away and the people in it
 * stay. It fills the space it is given and shows as many as that holds; when they do not all fit, the
 * last place is a `+N` chip (`moreLabel` names it) that calls `onMore`, which
 * unfolds the list. It sits in `SidebarListHead`'s `summary`, where a press
 * on a face or the chip never picks a sortable section up; the space
 * between them still does. When it mounts (as the list folds, or on a load
 * that finds it folded) the faces rise into the heading one after another,
 * left to right; reduced motion shows them at once.
 */
function BotFaces({
  moreLabel,
  onMore,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<'div'>, 'children'> & {
  children: React.ReactNode;
  moreLabel: (hidden: number) => string;
  onMore?: () => void;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [fit, setFit] = React.useState<number | null>(null);
  const faces = React.Children.toArray(children);

  // The outside system is the laid-out width of the heading's free space.
  React.useLayoutEffect(() => {
    const box = ref.current;
    if (!box) return;
    const measure = () => setFit(facesThatFit(box.clientWidth));
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  const shown = fit === null || faces.length <= fit ? faces.length : Math.max(0, fit - 1);
  const hidden = faces.length - shown;
  return (
    <div
      ref={ref}
      data-slot="bot-faces"
      role="list"
      className={cn('flex h-7 min-w-0 flex-1 items-center gap-1 overflow-hidden', className)}
      {...props}
    >
      {faces.slice(0, shown).map((face, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: each face is keyed by its caller; this wrapper only lists it
        <span
          key={index}
          role="listitem"
          className="flex shrink-0 motion-safe:animate-appear"
          style={{ animationDelay: `${index * FACE_STAGGER_MS}ms` }}
          onPointerDown={stopPress}
        >
          {face}
        </span>
      ))}
      {hidden > 0 ? (
        <span
          role="listitem"
          className="flex shrink-0 motion-safe:animate-appear"
          style={{ animationDelay: `${shown * FACE_STAGGER_MS}ms` }}
          onPointerDown={stopPress}
        >
          <button
            type="button"
            aria-label={moreLabel(hidden)}
            onClick={onMore}
            className="figures flex min-w-5 items-center justify-center rounded-xs bg-control px-1 py-0.75 text-micro tracking-normal text-fg-muted normal-case outline-none transition-colors duration-fast hover:text-fg focus-visible:outline-2 focus-visible:outline-ring"
          >
            +{hidden}
          </button>
        </span>
      ) : null}
    </div>
  );
}

/**
 * BotFaceItem — one bot in a folded list's `BotFaces`: its 20px face, which
 * opens its chat (`render`, a link). The state its row would show rides on
 * the face's corner as a 7px dot cut out of the sidebar: amber while it waits
 * on the person (`needsInput`), blue while unread; a working bot's face
 * breathes. The open chat's face is ringed in ink. `label` names the bot and
 * its state for a screen reader; the tooltip shows the name over `preview`.
 */
function BotFaceItem({
  name,
  label,
  initials,
  image,
  face,
  preview,
  working = false,
  unread = false,
  needsInput = false,
  active,
  className,
  render,
  ...props
}: Omit<React.ComponentProps<'button'>, 'children'> & {
  name: string;
  /** The name and the state, read in place of the face. */
  label: string;
  initials: string;
  image?: string;
  face?: BotFaceSpec;
  preview?: React.ReactNode;
  working?: boolean;
  unread?: boolean;
  needsInput?: boolean;
  active?: boolean;
  /** The element the face is: a link to the chat, so it reads and opens as one. */
  render?: React.ReactElement;
}) {
  const dot = needsInput ? 'bg-warning' : unread ? 'bg-primary' : null;
  return (
    <Tooltip>
      <TooltipTrigger
        render={render ?? <button type="button" />}
        data-slot="bot-face-item"
        data-active={active || undefined}
        data-working={working || undefined}
        aria-label={label}
        aria-current={active ? 'true' : undefined}
        className={cn(
          'relative flex shrink-0 rounded-xs outline-none ring-offset-1 ring-offset-sidebar focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring data-active:ring-1 data-active:ring-fg',
          className,
        )}
        {...props}
      >
        <BotAvatar
          option={{ image, initials }}
          size={FACE_SIZE}
          face={face}
          className={cn('transition-opacity duration-fast hover:opacity-85', working && 'motion-safe:animate-pulse')}
        />
        {dot ? (
          <span aria-hidden className="absolute -top-0.75 -right-0.75 flex size-2.75 rounded-pill bg-sidebar p-0.5">
            <span className={cn('size-full rounded-pill', dot)} />
          </span>
        ) : null}
      </TooltipTrigger>
      <TooltipContent side="bottom" align="center" sideOffset={6} className="flex-col items-start gap-0.5">
        <span className="font-medium">{name}</span>
        {preview ? <span className="line-clamp-3 opacity-75">{preview}</span> : null}
      </TooltipContent>
    </Tooltip>
  );
}

export { BotFaceItem, BotFaces };
