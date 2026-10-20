import type { ReactNode } from 'react';

/** One of the rail's quiet sections: its muted label, an `aside` beside it, its body under it. */
export function RailSection({
  label,
  aside,
  children,
}: {
  label: string;
  aside?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 border-b border-border-subtle py-4 first:pt-0 last:border-b-0">
      <div className="flex items-center justify-between gap-3 text-sm text-fg-muted">
        <h2 className="m-0 text-sm font-normal text-fg-muted">{label}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}
