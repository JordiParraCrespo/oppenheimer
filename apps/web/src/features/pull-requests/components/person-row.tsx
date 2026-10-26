import { Avatar, AvatarFallback, Skeleton } from '@oppenheimer/design-system-web';
import type { ReactNode } from 'react';

/**
 * A person in the rail, a commenter or a reviewer: their initials, their
 * login, and what they did beside it. Without a `login` it is the same row
 * still to come, a bar in each place, so the rail's rows have one shape
 * whether they have answered or not.
 */
export function PersonRow({ login, aside }: { login?: string; aside?: ReactNode }) {
  return (
    <div aria-hidden={login ? undefined : true} className="flex items-center gap-2.5 text-operate">
      {login ? (
        <Avatar size="sm">
          <AvatarFallback>{login.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
      ) : (
        <Skeleton shape="pill" className="size-5.5 shrink-0" />
      )}
      <span className="flex min-w-0 flex-1 items-center truncate text-fg">
        {login ? `@${login}` : <Skeleton shape="sm" className="h-3 w-24" />}
      </span>
      {aside ?? (login ? null : <Skeleton shape="sm" className="h-2.5 w-16" />)}
    </div>
  );
}
