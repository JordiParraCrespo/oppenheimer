/**
 * "No hosts yet", as the Settings frame draws it: a left-aligned card in the
 * list's place, not the centred `EmptyState` — its title and one line on
 * what the list will show.
 */
export function HostsEmpty({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-start gap-1.5 rounded-lg border border-border-subtle bg-card px-6 py-7">
      <span className="text-operate font-medium text-fg">{title}</span>
      <span className="text-sm text-fg-muted">{body}</span>
    </div>
  );
}
