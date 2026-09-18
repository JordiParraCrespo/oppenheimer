import { Avatar, AvatarFallback } from '@oppenheimer/design-system-web';
import type { AdminUserEntity } from '@oppenheimer/frontend-admin';

/** The first letters of the first two words, for an avatar with no image. */
function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || '?'
  );
}

/** The users table's first column: avatar, name, address. */
export function UserCell({ user }: { user: AdminUserEntity }) {
  return (
    <span className="flex items-center gap-3">
      <Avatar className="size-8">
        <AvatarFallback gradient="purple">{initials(user.name)}</AvatarFallback>
      </Avatar>
      <span className="min-w-0">
        <span className="block truncate font-medium text-ink-900">{user.name}</span>
        <span className="block truncate text-xs text-ink-400">{user.email}</span>
      </span>
    </span>
  );
}
