'use client';

import { Button as ButtonPrimitive } from '@base-ui/react/button';
import type * as React from 'react';

import { META_GIVES_WAY, ROW_BUTTON_WITH_ACTION, SidebarRow } from '../internal/sidebar-row';
import { cn } from '../lib/utils';
import { BotAvatar } from './avatar-picker';
import { useSortableControl } from './drag';

function BotList({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="bot-list" role="list" className={cn('flex flex-col gap-0.5', className)} {...props} />;
}

/**
 * BotItem — an employee in the sidebar: a chat with a named bot, so the row
 * reads like a conversation rather than a session. A 36px photo (initials in
 * ink until it loads) with a 10px green dot on its corner while the bot is
 * working; the name at 14px and the age in mono on the first line; the last
 * message at 12.5px muted on the second ("You: …" when it was yours). An
 * unread chat sets the name at 600, the preview in full ink and a 7px blue
 * dot at the end; one waiting on the person (`needsInput`: an approval, a
 * question) reads the same with an amber dot instead: both set
 * `data-attention`, which carries the weight. 52px, 14px radius, rows 2px
 * apart in a `BotList`.
 *
 * `action` is the row's ellipsis, shown on hover the way `SessionItem`'s is,
 * hiding the age while it shows.
 */
function BotItem({
  name,
  initials,
  image,
  preview,
  age,
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
  /** The last message, one line. */
  preview?: React.ReactNode;
  /** Relative age, mono ("2m", "1d"). */
  age?: string;
  /** The bot is working: the green dot on the photo. */
  live?: boolean;
  unread?: boolean;
  /** The bot is waiting on the person (an approval, a question): the amber dot in place of the blue. */
  needsInput?: boolean;
  active?: boolean;
  action?: React.ReactNode;
  menuOpen?: boolean;
  /** Props for the row's list item: a sortable row's node (`SortableBotItem`). */
  rowProps?: React.ComponentProps<'div'>;
}) {
  const withAction = action !== undefined;
  const inRow = withAction || rowProps !== undefined;
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
        'group/bot flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-fg outline-none transition-colors duration-fast ease-standard hover:bg-hover-surface focus-visible:outline-2 focus-visible:outline-ring data-active:bg-selected-surface data-active:hover:bg-selected-surface',
        withAction && ROW_BUTTON_WITH_ACTION,
        className,
      )}
      {...props}
    >
      <span className="relative flex shrink-0">
        <BotAvatar option={{ image, initials }} size={36} />
        {live ? (
          <span
            aria-hidden
            className="absolute -right-0.5 bottom-0.75 size-2.5 rounded-pill border-2 border-sidebar bg-success"
          />
        ) : null}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-baseline gap-2">
          <span className="min-w-0 flex-1 truncate text-[14px] font-medium tracking-[-0.009em] group-data-attention/bot:font-semibold">
            {name}
          </span>
          {age ? (
            <span className={cn('figures shrink-0 font-mono text-[11px] text-fg-subtle', withAction && META_GIVES_WAY)}>
              {age}
            </span>
          ) : null}
        </span>
        {preview ? (
          <span className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-[12.5px] text-fg-muted group-data-attention/bot:text-fg">
              {preview}
            </span>
            {needsInput ? (
              <span aria-label="Needs input" className="size-1.75 shrink-0 rounded-pill bg-warning" />
            ) : unread ? (
              <span aria-label="Unread" className="size-1.75 shrink-0 rounded-pill bg-primary" />
            ) : null}
          </span>
        ) : null}
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
  return <BotItem {...props} {...control} rowProps={{ ...node, hidden, className: cn(node.className, 'rounded-md') }} />;
}

export { BotItem, BotList, SortableBotItem };
