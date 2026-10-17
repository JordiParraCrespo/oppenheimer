import { XIcon } from 'lucide-react';
import type * as React from 'react';

import { cn } from '../lib/utils';
import { Badge } from './badge';
import { IconButton } from './icon-button';

/**
 * AccessList — who can open a shared thing, and until when (Share's Who has
 * access). A hairline card at the 14px radius, hairlines between the rows.
 * The first row is the owner, who cannot be removed; a link is a row of its
 * own ("Anyone with the link"), so stopping it reads like removing a person.
 *
 * ```tsx
 * <AccessList>
 *   <AccessRow avatar={<Avatar …/>} name="Jordi Parra" sub="jordi@acme.dev" role="Owner" />
 *   <AccessRow avatar={…} name="Lea Brandt" sub="lea@acme.dev" role="Can view" ends="23h left" onRemove={…} />
 * </AccessList>
 * ```
 */
function AccessList({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="access-list"
      role="list"
      className={cn('flex flex-col divide-y divide-border-subtle rounded-md border border-border-subtle', className)}
      {...props}
    />
  );
}

/**
 * One holder: a 22px avatar, the name at 13.5px over a 12px subtle line (the
 * email, "outside workspace", "Must sign in to open"), the role as a neutral
 * `Badge`, then how long is left in mono, right-aligned in a 72px column so
 * the ends line up down the list. `onRemove` adds the × (Remove access);
 * without it the row keeps the button's room, so the times stay aligned.
 */
function AccessRow({
  avatar,
  name,
  sub,
  role,
  ends,
  onRemove,
  removeLabel = 'Remove access',
  className,
  ...props
}: Omit<React.ComponentProps<'div'>, 'role'> & {
  avatar: React.ReactNode;
  name: React.ReactNode;
  sub?: React.ReactNode;
  role: React.ReactNode;
  /** How long is left ("23h left", "Never"); empty for the owner. */
  ends?: React.ReactNode;
  onRemove?: () => void;
  removeLabel?: string;
}) {
  return (
    <div
      data-slot="access-row"
      role="listitem"
      className={cn('flex min-h-13 items-center gap-2.5 py-1.5 pr-2 pl-3', className)}
      {...props}
    >
      <span className="flex flex-none">{avatar}</span>
      <span className="flex min-w-0 flex-1 flex-col gap-px">
        <span className="truncate text-[13.5px]">{name}</span>
        {sub ? <span className="truncate text-[12px] text-fg-subtle">{sub}</span> : null}
      </span>
      <Badge variant="neutral" className="flex-none">
        {role}
      </Badge>
      <span className="figures w-18 flex-none text-right font-mono text-[11.5px] text-fg-subtle">{ends}</span>
      {onRemove ? (
        <IconButton size="sm" variant="quiet" aria-label={removeLabel} title={removeLabel} onClick={onRemove}>
          <XIcon />
        </IconButton>
      ) : (
        <span aria-hidden className="w-(--control-h-sm) flex-none" />
      )}
    </div>
  );
}

export { AccessList, AccessRow };
