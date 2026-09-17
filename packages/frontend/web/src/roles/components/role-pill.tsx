import { Badge } from '@oppenheimer/design-system-web';

/**
 * A role, named next to a coloured dot.
 *
 * The colour is decoration keyed to the role name, not a status signal, which
 * is why this is a `neutral` badge with a dot rather than one of `Badge`'s
 * status tones — those are reserved for active/paused/ended/draft.
 *
 * Role names come from the database and are free-form, so the lookup is
 * case-insensitive and anything unrecognised falls back to grey.
 */
const ROLE_COLORS: Record<string, string> = {
  owner: 'var(--status-paused)',
  admin: 'var(--accent-purple)',
  superadmin: 'var(--accent-purple)',
  'seo manager': 'var(--accent-blue)',
  manager: 'var(--accent-blue)',
  editor: 'var(--accent-cyan)',
  analyst: 'var(--status-active)',
  viewer: 'var(--ink-400)',
  user: 'var(--ink-400)',
};

const FALLBACK_COLOR = 'var(--ink-400)';

export function RolePill({ role }: { role: string }) {
  return (
    <Badge
      variant="neutral"
      className="gap-[7px] border border-border-subtle py-1 pr-2.5 pl-2 text-sm text-ink-900"
    >
      <span
        aria-hidden="true"
        className="size-[7px] flex-none rounded-full"
        style={{
          background: ROLE_COLORS[role.toLowerCase()] ?? FALLBACK_COLOR,
        }}
      />
      {role}
    </Badge>
  );
}
