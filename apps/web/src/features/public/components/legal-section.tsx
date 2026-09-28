import type { ReactNode } from 'react';

/** One titled section of a legal page. */
export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-xl font-semibold text-ink-900">{title}</h2>
      <div className="space-y-3 text-base leading-7 text-ink-600">{children}</div>
    </section>
  );
}
