'use client';

import { Button as ButtonPrimitive } from '@base-ui/react/button';
import type * as React from 'react';

import { META_GIVES_WAY, ROW_BUTTON_WITH_ACTION, SidebarRow } from '../internal/sidebar-row';
import { cn } from '../lib/utils';
import { type AvatarColor, BotAvatar } from './avatar-picker';
import { useSortableControl } from './drag';
import { Skeleton } from './skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip';

function BotList({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="bot-list" role="list" className={cn('flex flex-col gap-px', className)} {...props} />;
}

/**
 * BotItem — an employee in the sidebar, on one line: a 20px square photo
 * (initials in ink until it loads) with a 9px green dot on its corner while
 * the bot is working, then the name at 14px. The last message is the row's
 * tooltip, beside it on hover ("You: …" when it was yours). An unread chat
 * sets the name at 600 with a 7px blue dot at the end; one waiting on the
 * person (`needsInput`: an approval, a question) does the same with an amber
 * dot: both set `data-attention`, which carries the weight. 32px, the nav
 * radius, rows 1px apart in a `BotList`.
 *
 * `action` is the row's ellipsis, shown on hover the way `SessionItem`'s is,
 * hiding the dots while it shows.
 */
function BotItem({
  name,
  initials,
  image,
  color,
  preview,
  live = false,
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
}: Omit<ButtonPrimitive.Props, 'children'> & {
  name: string;
  initials: string;
  image?: string;
  /** The avatar colour the initials sit on, for a bot with no photo. */
  color?: AvatarColor;
  /** The last message, shown in the row's tooltip. */
  preview?: React.ReactNode;
  /** The bot is working: the green dot on the photo. */
  live?: boolean;
  unread?: boolean;
  /** The bot is waiting on the person (an approval, a question): the amber dot. */
  needsInput?: boolean;
  active?: boolean;
  action?: React.ReactNode;
  menuOpen?: boolean;
  /** Props for the row's list item: a sortable row's node (`SortableBotItem`). */
  rowProps?: React.ComponentProps<'div'>;
}) {
  const withAction = action !== undefined;
  const inRow = withAction || rowProps !== undefined;
  const dot = 'size-1.75 shrink-0 rounded-pill';
  const button = (
    <ButtonPrimitive
      data-slot="bot-item"
      data-active={active || undefined}
      data-unread={unread || undefined}
      data-needs-input={needsInput || undefined}
      data-attention={unread || needsInput || undefined}
      role={inRow ? undefined : 'listitem'}
      aria-current={active ? 'true' : undefined}
      render={render}
      nativeButton={nativeButton ?? render === undefined}
      className={cn(
        'group/bot flex h-8 w-full items-center gap-2.5 rounded-nav px-2.5 text-left text-fg outline-none transition-colors duration-fast ease-standard hover:bg-hover-surface focus-visible:outline-2 focus-visible:outline-ring data-active:bg-selected-surface data-active:hover:bg-selected-surface',
        withAction && ROW_BUTTON_WITH_ACTION,
        className,
      )}
      {...props}
    >
      <span className="relative flex shrink-0">
        <BotAvatar option={{ image, initials }} size={20} color={color} className="rounded-xs" />
        {live ? (
          <span
            aria-hidden
            className="absolute -right-0.75 -bottom-0.75 size-2.25 rounded-pill border-2 border-sidebar bg-success"
          />
        ) : null}
      </span>
      <span className="min-w-0 flex-1 truncate text-[14px] font-medium group-data-attention/bot:font-semibold">
        {name}
      </span>
      {needsInput || unread ? (
        <span className={cn('flex shrink-0 items-center gap-1.5', withAction && META_GIVES_WAY)}>
          {needsInput ? <span aria-label="Needs input" className={cn(dot, 'bg-warning')} /> : null}
          {unread ? <span aria-label="Unread" className={cn(dot, 'bg-primary')} /> : null}
        </span>
      ) : null}
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
 * BotItemSkeleton — a `BotItem` while the list loads: the 20px square and a
 * name's bar on the row's 32px line.
 */
function BotItemSkeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      aria-hidden
      data-slot="bot-item-skeleton"
      className={cn('flex h-8 items-center gap-2.5 px-2.5', className)}
      {...props}
    >
      <Skeleton shape="sm" className="size-5 shrink-0 rounded-xs" />
      <Skeleton shape="sm" className="h-3.5 w-28" />
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

export { BotItem, BotItemSkeleton, BotList, SortableBotItem };
