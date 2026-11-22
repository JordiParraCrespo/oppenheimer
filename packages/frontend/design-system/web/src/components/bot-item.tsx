'use client';

import { Button as ButtonPrimitive } from '@base-ui/react/button';
import type * as React from 'react';

import { META_GIVES_WAY, ROW_BUTTON_WITH_ACTION, SidebarRow } from '../internal/sidebar-row';
import { cn } from '../lib/utils';
import { BotAvatar, type BotFaceSpec } from './avatar-picker';
import { useSortableControl } from './drag';
import { Skeleton } from './skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip';
import { variedWidth } from '../internal/varied-width';

function BotList({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="bot-list" role="list" className={cn('flex flex-col gap-px', className)} {...props} />;
}

/**
 * The bot's photo on a row: the square (initials in ink until it loads, its
 * drawn face without one) with a 9px green dot on its corner while it is
 * `live`. Shared by `BotItem` and `BotPreviewItem`, which differ in its size.
 */
function BotRowFace({
  image,
  initials,
  face,
  live,
  size,
}: {
  image?: string;
  initials: string;
  face?: BotFaceSpec;
  live: boolean;
  size: number;
}) {
  return (
    <span className="relative flex shrink-0">
      <BotAvatar option={{ image, initials }} size={size} face={face} />
      {live ? (
        // The dot's cutout is the row's ground: the sidebar, under the
        // row's own wash when it is hovered, its menu is open, or it is the
        // open chat. The washes are translucent, so they are laid over the
        // sidebar rather than standing in for it.
        <span
          aria-hidden
          className="absolute -right-0.75 -bottom-0.75 flex size-2.25 rounded-pill bg-sidebar p-0.5"
        >
          <span className="absolute inset-0 rounded-pill group-hover/bot:bg-hover-surface group-hover/row:bg-hover-surface group-data-menu-open/row:bg-hover-surface group-data-active/bot:hidden" />
          <span className="absolute inset-0 rounded-pill group-data-active/bot:bg-selected-surface" />
          <span className="relative size-full rounded-pill bg-success" />
        </span>
      ) : null}
    </span>
  );
}

/** The amber dot of a bot waiting on the person and the blue one of an unread chat, at a row's end. */
function BotRowDots({ needsInput, unread, givesWay }: { needsInput: boolean; unread: boolean; givesWay: boolean }) {
  if (!needsInput && !unread) return null;
  const dot = 'size-1.75 shrink-0 rounded-pill';
  return (
    <span className={cn('flex shrink-0 items-center gap-1.5', givesWay && META_GIVES_WAY)}>
      {needsInput ? <span aria-label="Needs input" className={cn(dot, 'bg-warning')} /> : null}
      {unread ? <span aria-label="Unread" className={cn(dot, 'bg-primary')} /> : null}
    </span>
  );
}

/** The bot's name at 14px, 600 while the row asks for attention, breathing while it is `working`. */
function BotRowName({ name, working }: { name: string; working: boolean }) {
  return (
    <span
      className={cn(
        'min-w-0 flex-1 truncate text-[14px] font-medium group-data-attention/bot:font-semibold',
        working && 'motion-safe:animate-shimmer',
      )}
    >
      {name}
    </span>
  );
}

const ROW_BUTTON =
  'group/bot flex w-full items-center rounded-nav px-2.5 text-left text-fg outline-none transition-colors duration-fast ease-standard hover:bg-hover-surface focus-visible:outline-2 focus-visible:outline-ring data-active:bg-selected-surface data-active:hover:bg-selected-surface';

type BotRowProps = Omit<ButtonPrimitive.Props, 'children'> & {
  name: string;
  initials: string;
  image?: string;
  /** The bot's colour and id: with no photo, its drawn face; without, its initials. */
  face?: BotFaceSpec;
  /** The last message. */
  preview?: React.ReactNode;
  /** The bot is live: the green dot on the photo. */
  live?: boolean;
  /** The bot is at work: the name shimmers, as a working session's does. */
  working?: boolean;
  unread?: boolean;
  /** The bot is waiting on the person (an approval, a question): the amber dot. */
  needsInput?: boolean;
  active?: boolean;
  action?: React.ReactNode;
  menuOpen?: boolean;
  /** Props for the row's list item: a sortable row's node (`SortableBotItem`). */
  rowProps?: React.ComponentProps<'div'>;
};

/** The state every bot row's button carries, for the row's own styles and its parts'. */
function rowState({ active, working, unread, needsInput }: { active?: boolean; working: boolean; unread: boolean; needsInput: boolean }) {
  return {
    'data-active': active || undefined,
    'data-working': working || undefined,
    'data-unread': unread || undefined,
    'data-needs-input': needsInput || undefined,
    'data-attention': unread || needsInput || undefined,
    'aria-current': active ? ('true' as const) : undefined,
  };
}

/**
 * BotItem — an employee in the sidebar, on one line: a 20px square photo
 * (initials in ink until it loads) with a 9px green dot on its corner while
 * the bot is `live`, then the name at 14px, which breathes while it is
 * `working` as a working `SessionItem`'s does (`animate-shimmer`). The last message is the row's
 * tooltip, beside it on hover ("You: …" when it was yours). An unread chat
 * sets the name at 600 with a 7px blue dot at the end; one waiting on the
 * person (`needsInput`: an approval, a question) does the same with an amber
 * dot: both set `data-attention`, which carries the weight. 32px, the nav
 * radius, rows 1px apart in a `BotList`. `BotPreviewItem` is the two-line row.
 *
 * `action` is the row's ellipsis, shown on hover the way `SessionItem`'s is,
 * hiding the dots while it shows.
 */
function BotItem({
  name,
  initials,
  image,
  face,
  preview,
  live = false,
  working = false,
  unread = false,
  needsInput = false,
  active,
  action,
  menuOpen,
  rowProps,
  className,
  render,
  nativeButton,
  ...props
}: BotRowProps) {
  const withAction = action !== undefined;
  const inRow = withAction || rowProps !== undefined;
  const button = (
    <ButtonPrimitive
      data-slot="bot-item"
      {...rowState({ active, working, unread, needsInput })}
      role={inRow ? undefined : 'listitem'}
      render={render}
      nativeButton={nativeButton ?? render === undefined}
      className={cn(ROW_BUTTON, 'h-8 gap-2.5', withAction && ROW_BUTTON_WITH_ACTION, className)}
      {...props}
    >
      <BotRowFace image={image} initials={initials} face={face} live={live} size={20} />
      <BotRowName name={name} working={working} />
      <BotRowDots needsInput={needsInput} unread={unread} givesWay={withAction} />
    </ButtonPrimitive>
  );

  const row = preview ? (
    <Tooltip>
      <TooltipTrigger render={button} />
      <TooltipContent side="right" align="center" sideOffset={8}>
        <span className="line-clamp-3">{preview}</span>
      </TooltipContent>
    </Tooltip>
  ) : (
    button
  );

  if (!inRow) return row;
  return (
    <SidebarRow slot="bot-row" action={action} menuOpen={menuOpen} {...rowProps}>
      {row}
    </SidebarRow>
  );
}

/**
 * BotPreviewItem — an employee in the sidebar the way a messaging app's chat
 * list reads it: a 32px photo with `BotItem`'s live dot, then two lines, the
 * name with the `time` of its last activity at the end (12px, subtle ink),
 * and under it the last message at 13px in the subtle ink, one line, with
 * `BotItem`'s dots at its end. No tooltip: the message is on the row. 52px,
 * the nav radius. `action` is the ellipsis, over both lines on hover, hiding
 * the time and the dots while it shows.
 */
function BotPreviewItem({
  name,
  initials,
  image,
  face,
  preview,
  time,
  live = false,
  working = false,
  unread = false,
  needsInput = false,
  active,
  action,
  menuOpen,
  rowProps,
  className,
  render,
  nativeButton,
  ...props
}: BotRowProps & {
  /** When the bot was last active ("09:28", "Yesterday"). */
  time?: React.ReactNode;
}) {
  const withAction = action !== undefined;
  const inRow = withAction || rowProps !== undefined;
  const button = (
    <ButtonPrimitive
      data-slot="bot-preview-item"
      {...rowState({ active, working, unread, needsInput })}
      role={inRow ? undefined : 'listitem'}
      render={render}
      nativeButton={nativeButton ?? render === undefined}
      className={cn(ROW_BUTTON, 'h-13 gap-3', withAction && ROW_BUTTON_WITH_ACTION, className)}
      {...props}
    >
      <BotRowFace image={image} initials={initials} face={face} live={live} size={32} />
      <span
        className={cn(
          'flex min-w-0 flex-1 flex-col gap-0.5',
          // Room for the ellipsis, which sits over both lines.
          withAction && 'group-hover/row:pr-6 group-has-focus-visible/row:pr-6 group-data-menu-open/row:pr-6',
        )}
      >
        <span className="flex min-w-0 items-baseline gap-2">
          <BotRowName name={name} working={working} />
          {time ? (
            <span className={cn('shrink-0 text-[12px] text-fg-subtle tabular-nums', withAction && META_GIVES_WAY)}>
              {time}
            </span>
          ) : null}
        </span>
        <span className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-[13px] leading-4.5 text-fg-subtle">{preview}</span>
          <BotRowDots needsInput={needsInput} unread={unread} givesWay={withAction} />
        </span>
      </span>
    </ButtonPrimitive>
  );

  if (!inRow) return button;
  return (
    <SidebarRow slot="bot-row" action={action} menuOpen={menuOpen} {...rowProps}>
      {button}
    </SidebarRow>
  );
}

const SKELETON_NAMES = ['w-28', 'w-20', 'w-32', 'w-24'] as const;

/**
 * BotItemSkeleton — a `BotItem` while the list loads: the 20px square and a
 * name's bar on the row's 32px line. `index` varies the name's width.
 */
function BotItemSkeleton({ index = 0, className, ...props }: React.ComponentProps<'div'> & { index?: number }) {
  return (
    <div
      aria-hidden
      data-slot="bot-item-skeleton"
      className={cn('flex h-8 items-center gap-2.5 px-2.5', className)}
      {...props}
    >
      <Skeleton shape="sm" className="size-5 shrink-0 rounded-xs" />
      <Skeleton shape="sm" className={cn('h-3.5', variedWidth(index, SKELETON_NAMES))} />
    </div>
  );
}

/**
 * BotPreviewItemSkeleton — a `BotPreviewItem` while the list loads: the 32px
 * square, the name's bar and a longer one for the message, on its 52px.
 * `index` varies the name's width.
 */
function BotPreviewItemSkeleton({ index = 0, className, ...props }: React.ComponentProps<'div'> & { index?: number }) {
  return (
    <div
      aria-hidden
      data-slot="bot-preview-item-skeleton"
      className={cn('flex h-13 items-center gap-3 px-2.5', className)}
      {...props}
    >
      <Skeleton shape="sm" className="size-8 shrink-0 rounded-xs" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Skeleton shape="sm" className={cn('h-3.5', variedWidth(index, SKELETON_NAMES))} />
        <Skeleton shape="sm" className="h-3 w-4/5" />
      </div>
    </div>
  );
}

/**
 * SortableBotItem — a `BotItem` the reader drags into another group or into
 * another place in its own, on the shell's drag layer the way
 * `SortableSessionItem` moves a session: the row is the sortable node and its
 * button the control, so a click opens the chat and a drag picks it up.
 */
function SortableBotItem({
  id,
  disabled,
  hidden,
  ...props
}: Omit<React.ComponentProps<typeof BotItem>, 'rowProps' | 'disabled' | 'hidden'> & {
  id: string;
  disabled?: boolean;
  hidden?: boolean;
}) {
  const { node, control } = useSortableControl({ id, data: { type: 'bot', label: props.name }, disabled });
  return <BotItem {...props} {...control} rowProps={{ ...node, hidden, className: cn(node.className, 'rounded-nav') }} />;
}

/**
 * SortableBotPreviewItem — a `BotPreviewItem` that drags as `SortableBotItem`
 * does.
 */
function SortableBotPreviewItem({
  id,
  disabled,
  hidden,
  ...props
}: Omit<React.ComponentProps<typeof BotPreviewItem>, 'rowProps' | 'disabled' | 'hidden'> & {
  id: string;
  disabled?: boolean;
  hidden?: boolean;
}) {
  const { node, control } = useSortableControl({ id, data: { type: 'bot', label: props.name }, disabled });
  return (
    <BotPreviewItem {...props} {...control} rowProps={{ ...node, hidden, className: cn(node.className, 'rounded-nav') }} />
  );
}

export {
  BotItem,
  BotItemSkeleton,
  BotList,
  BotPreviewItem,
  BotPreviewItemSkeleton,
  SortableBotItem,
  SortableBotPreviewItem,
};
