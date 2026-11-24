import type { ReactNode } from 'react';

export function LegalSection({
  id,
  title,
  children,
}: {
  /** The section's anchor, for a link straight to it (`/privacy#extension`). */
  id?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id}>
      <h2 className="mb-3 text-xl font-semibold text-ink-900">{title}</h2>
      <div className="space-y-3 text-base leading-7 text-ink-600">{children}</div>
    </section>
  );
}
