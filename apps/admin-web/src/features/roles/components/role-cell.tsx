import { Shield } from '@oppenheimer/design-system-web/icons';
import type { RoleEntity } from '@oppenheimer/frontend-admin';

/**
 * The roles table's first column: the shield tile, the name, the description.
 *
 * Its own component because it is the expensive cell — a tile, two spans and a
 * truncation per row — and a component is the unit the compiler holds still.
 * Inline in the column's `render`, it was rebuilt whenever anything about the
 * table changed.
 */
export function RoleCell({ role }: { role: RoleEntity }) {
  return (
    <span className="flex items-center gap-3">
      <span className="flex size-8 flex-none items-center justify-center rounded-lg border border-border-subtle bg-surface-sunken text-ink-600">
        <Shield className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block font-medium text-ink-900">{role.name}</span>
        <span className="block max-w-96 truncate text-xs text-ink-400">
          {role.description || '—'}
        </span>
      </span>
    </span>
  );
}
