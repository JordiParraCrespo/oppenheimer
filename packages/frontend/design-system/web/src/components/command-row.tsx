'use client';

import { CheckIcon, CopyIcon } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/utils';
import { IconButton } from './icon-button';

type CommandRowSurface = 'card' | 'terminal';

/**
 * CommandRow — one command a person runs on their own machine, as a line
 * they copy: an optional lead sentence above ("To see what went wrong:"),
 * then a 34px 10px-radius well on the hover wash with a faint `$`, the mono
 * command truncating on one line, and a 28px icon button at the right that
 * copies it. The button's name is the action ("Copy command") and turns to
 * "Copied", with a check, for a moment.
 *
 * Where `CodeBlock` holds a block someone reads before copying, this is the
 * fix for a host that went offline, drawn wherever that news is: the
 * terminal's drawer and notice, and an offline `HostCard`. `surface` picks
 * the ink of the lead and the `$`: `terminal` on the terminal face, `card`
 * (default) everywhere else.
 *
 * The labels default to English because the design system carries no
 * catalog; an app that translates passes its own.
 */
function CommandRow({
  command,
  lead,
  surface = 'card',
  copyLabel = 'Copy command',
  copiedLabel = 'Copied',
  className,
  ...props
}: React.ComponentProps<'div'> & {
  command: string;
  lead?: React.ReactNode;
  surface?: CommandRowSurface;
  copyLabel?: string;
  copiedLabel?: string;
}) {
  const [copied, setCopied] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout>>(undefined);

  React.useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard denied: the command is still selectable.
    }
  }

  const label = copied ? copiedLabel : copyLabel;
  return (
    <div
      data-slot="command-row"
      data-surface={surface}
      className={cn('flex flex-col gap-1.5', className)}
      {...props}
    >
      {lead ? (
        <span className={cn('text-[12.5px]', surface === 'terminal' ? 'text-term-dim' : 'text-fg-muted')}>
          {lead}
        </span>
      ) : null}
      <div className="flex h-[34px] items-center gap-2 rounded-sm bg-hover-surface pr-1 pl-3 font-mono text-[12.5px]">
        <span aria-hidden className={cn('shrink-0', surface === 'terminal' ? 'text-term-dim' : 'text-fg-subtle')}>
          $
        </span>
        <span className="min-w-0 flex-1 truncate whitespace-nowrap">{command}</span>
        <IconButton size="sm" aria-label={label} title={label} onClick={copy}>
          {copied ? <CheckIcon strokeWidth={2.2} /> : <CopyIcon />}
        </IconButton>
      </div>
    </div>
  );
}

/** Stacks `CommandRow`s 10px apart at a readable width. */
function CommandRowList({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="command-row-list" className={cn('flex max-w-140 flex-col gap-2.5', className)} {...props} />;
}

export { CommandRow, CommandRowList };
export type { CommandRowSurface };
