import { Card } from "@oppenheimer/design-system-web/card";

/**
 * The main column, centred on the inventory's 880px measure. Side padding
 * steps 16 → 32 → 48 with the viewport: at 48px flat, a phone loses a quarter
 * of its width to gutters. Carries the id the sidebar's scroll-spy observes,
 * since this element — not the window — is what actually scrolls.
 */
export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <main
      id="main-scroll"
      className="min-h-0 flex-1 overflow-y-auto px-4 pt-8 pb-16 sm:px-8 sm:pt-11 lg:px-12"
    >
      <div className="mx-auto max-w-[880px]">{children}</div>
    </main>
  );
}

/**
 * PageHead — 24px medium title over a 14px secondary-ink line, with an optional
 * action pinned right. 32px of air before the content starts.
 */
export function PageHead({
  title,
  sub,
  action,
}: {
  title: string;
  sub?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-60 flex-[1_1_320px]">
        <h1 className="mb-1.5 text-2xl font-medium">{title}</h1>
        {sub ? (
          <p className="text-base text-pretty text-ink-600">{sub}</p>
        ) : null}
      </div>
      {action ? <div className="flex-none">{action}</div> : null}
    </div>
  );
}

/**
 * Spec — one entry in the component inventory: a 24px title with its source in
 * mono, a one-line description, then the live demo on the sunken canvas inside
 * a flat card. `code` adds the usage line in a hairline-divided footer.
 */
export function Spec({
  id,
  title,
  meta,
  desc,
  code,
  children,
}: {
  id: string;
  title: string;
  meta?: string;
  desc?: string;
  code?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mb-14 scroll-mt-6">
      <div className="flex flex-wrap items-baseline gap-3">
        <h2 className="text-2xl font-medium">{title}</h2>
        {meta ? (
          <span className="mono text-ink-400">{meta}</span>
        ) : null}
      </div>
      {desc ? (
        <p className="mt-2 max-w-[620px] text-base leading-normal text-pretty text-ink-600">
          {desc}
        </p>
      ) : null}
      <Card className="mt-4.5 gap-0 py-0">
        <div className="flex flex-wrap items-start gap-5 bg-surface-canvas p-4 sm:gap-7 sm:p-7">
          {children}
        </div>
        {code ? (
          <div className="border-t border-border-subtle bg-card px-4 py-3">
            <code className="mono whitespace-pre-wrap text-ink-600">
              {code}
            </code>
          </div>
        ) : null}
      </Card>
    </section>
  );
}

/**
 * Swatch — a labelled specimen inside a Spec. The 40px min-height keeps a row
 * of differently-sized controls sitting on one baseline.
 */
export function Swatch({
  label,
  width,
  children,
}: {
  label?: string;
  width?: number | string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex flex-col items-start gap-2.5"
      style={width ? { width } : undefined}
    >
      <div className="flex min-h-10 items-center">{children}</div>
      {label ? <span className="text-xs text-ink-400">{label}</span> : null}
    </div>
  );
}
